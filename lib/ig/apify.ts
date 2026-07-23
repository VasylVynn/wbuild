import "server-only";
import { normalizeIgHandle } from "@/lib/blocks/contact-links";

/**
 * Instagram scraping (wave E, rebuilt for refactor §1.2/§1.3): pull a public
 * profile AND its recent posts from Apify so the onboarding/editor agent can seed
 * a site — and the dossier — from a handle the owner already has. Two actors:
 *   - `apify~instagram-profile-scraper` — profile + a quick ≤15-post preview.
 *   - `apify~instagram-post-scraper`    — last ~20 posts WITH carousel children.
 * The old parser kept only avatar + one image per post and threw away bio links,
 * business fields, captions, hashtags and carousel children; the new one keeps
 * EVERYTHING (refactor §1.2 "discard nothing").
 *
 * ASYNC RUN, not run-sync. The `run-sync-get-dataset-items` endpoint blocks for
 * the actor's entire runtime, which routinely outlives a serverless action's
 * execution budget (the socket dies before the scrape finishes). Starting the
 * run, polling status, then fetching the dataset lets US own the deadline and
 * emit phase updates for the chat UI.
 *
 * FAIL-OPEN contract: every failure path (missing token, invalid handle, HTTP
 * error, run FAILED/ABORTED/TIMED-OUT, deadline hit, empty/undecodable dataset)
 * resolves to `null` after a generic `console.warn`. This never throws — the
 * caller treats `null` as "no Instagram data" and continues by hand. The token
 * and any token-bearing URL are NEVER logged.
 *
 * Cost: profile + posts runs are ~$0.02–0.10 per onboarding (refactor §7).
 */

const APIFY_BASE = "https://api.apify.com/v2";
const PROFILE_ACTOR = "apify~instagram-profile-scraper";
const POST_ACTOR = "apify~instagram-post-scraper";

const POLL_INTERVAL_MS = 3_000;
const DEFAULT_TIMEOUT_MS = 150_000;
const MAX_PROFILE_POSTS = 15; // the profile scraper's latestPosts preview cap
const DEFAULT_POST_LIMIT = 20;

// Per-request caps so a hung socket can never blow past the overall deadline
// (same fail-open reasoning as lib/media/analyze-photo.ts).
const START_TIMEOUT_MS = 20_000;
const POLL_TIMEOUT_MS = 15_000;
const DATASET_TIMEOUT_MS = 30_000;

// Terminal run statuses that mean "no data is coming".
const FAILED_STATUSES = new Set(["FAILED", "ABORTED", "TIMED-OUT"]);

/** One normalized post — carousel children included, nothing discarded. */
export type IgParsedPost = {
  id: string;
  type: "image" | "carousel" | "video";
  caption?: string;
  timestamp?: string;
  likes?: number;
  comments?: number;
  hashtags: string[];
  locationName?: string;
  /** ALL still images to display/import (carousel children; video cover). */
  imageUrls: string[];
  videoThumbUrl?: string;
  videoUrl?: string;
};

/** One normalized profile — the full view persisted into `ig_snapshots.parsed`. */
export type IgParsedProfile = {
  handle: string;
  fullName?: string;
  biography?: string;
  followersCount?: number;
  postsCount?: number;
  verified?: boolean;
  isBusinessAccount?: boolean;
  businessCategoryName?: string;
  /** externalUrl + bioLinks, deduped. Requisite CANDIDATES, never facts. */
  externalUrls: string[];
  businessPhone?: string;
  businessEmail?: string;
  avatarUrl?: string;
  posts: IgParsedPost[];
};

export function isApifyConfigured(): boolean {
  return Boolean(process.env.APIFY_API_TOKEN?.trim());
}

/** Warn generically (never leak the token or a token-bearing URL) and bail. */
function fail(reason: string): null {
  console.warn(`[apify] ${reason}`);
  return null;
}

function resolveTimeoutMs(): number {
  const parsed = parseInt(process.env.APIFY_TIMEOUT_MS ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

async function timedFetch(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

/** Trimmed non-empty string, else undefined — so empty fields become omitted. */
function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

/** Finite number from a number or numeric string, else undefined. */
function num(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number.parseInt(v.replace(/[^0-9]/g, ""), 10);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/** A `url` field is only trusted as an image when it looks like an image CDN. */
function looksLikeImageUrl(u: string): boolean {
  return /\.(jpe?g|png|webp|gif)(\?|$)/i.test(u) || /cdninstagram|fbcdn/i.test(u);
}

export type ApifyPhase = "starting" | "scraping" | "fetching";

/**
 * Generic async-run → poll → fetch-dataset driver, shared by both actors. Returns
 * the dataset items array or `null` on any failure (fail-open). `opts.deadline`
 * lets a caller enforce a shared budget across several scrapes; otherwise each
 * run gets its own APIFY_TIMEOUT_MS budget.
 */
async function runActorDataset(
  actor: string,
  input: Record<string, unknown>,
  opts?: { onPhase?: (phase: ApifyPhase) => void; deadline?: number },
): Promise<unknown[] | null> {
  const token = process.env.APIFY_API_TOKEN?.trim();
  if (!token) return fail("APIFY_API_TOKEN not set");

  const deadline = opts?.deadline ?? Date.now() + resolveTimeoutMs();

  try {
    // 1) Start the async run.
    opts?.onPhase?.("starting");
    const startRes = await timedFetch(
      `${APIFY_BASE}/acts/${actor}/runs?token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
      START_TIMEOUT_MS,
    );
    if (!startRes.ok) return fail(`start run failed: HTTP ${startRes.status}`);
    const startData = asRecord(asRecord(await startRes.json()).data);
    const runId = str(startData.id);
    const datasetId = str(startData.defaultDatasetId);
    if (!runId || !datasetId) return fail("start run returned no run id");

    // 2) Poll the run until it succeeds, fails, or we hit the deadline. Every
    // wait — fetch or sleep — is clamped to the REMAINING deadline so the
    // overall budget is accurate (codex review), not deadline + one more step.
    const remaining = () => deadline - Date.now();
    let announced = false;
    for (;;) {
      if (remaining() <= 0) return fail("run deadline exceeded");
      if (!announced) {
        opts?.onPhase?.("scraping");
        announced = true;
      }
      const statusRes = await timedFetch(
        `${APIFY_BASE}/actor-runs/${runId}?token=${token}`,
        {},
        Math.min(POLL_TIMEOUT_MS, Math.max(1, remaining())),
      );
      if (!statusRes.ok) return fail(`poll failed: HTTP ${statusRes.status}`);
      const status = str(asRecord(asRecord(await statusRes.json()).data).status) ?? "";
      if (status === "SUCCEEDED") break;
      if (FAILED_STATUSES.has(status)) return fail(`run failed: ${status}`);
      if (remaining() <= POLL_INTERVAL_MS) return fail("run deadline exceeded");
      await sleep(POLL_INTERVAL_MS);
    }

    // 3) Fetch the dataset.
    opts?.onPhase?.("fetching");
    if (remaining() <= 0) return fail("run deadline exceeded");
    const dsRes = await timedFetch(
      `${APIFY_BASE}/datasets/${datasetId}/items?token=${token}&clean=true&format=json`,
      {},
      Math.min(DATASET_TIMEOUT_MS, Math.max(1, remaining())),
    );
    if (!dsRes.ok) return fail(`dataset fetch failed: HTTP ${dsRes.status}`);
    const items = await dsRes.json();
    if (!Array.isArray(items)) return fail("dataset not an array");
    return items;
  } catch {
    // Network error, abort/timeout, or malformed JSON — stay fail-open. The
    // error is not logged: fetch errors can embed the token-bearing URL.
    return fail("apify run failed");
  }
}

/** Post image: displayUrl → images[0] → url (only if it looks like an image). */
function collectImageUrls(post: Record<string, unknown>): string[] {
  const out: string[] = [];
  const push = (u: string | undefined) => {
    if (u && u.startsWith("https:") && !out.includes(u)) out.push(u);
  };
  // Carousel children first — the whole point of the post scraper (§1.3).
  const children = Array.isArray(post.childPosts) ? post.childPosts : [];
  for (const child of children) push(str(asRecord(child).displayUrl));
  push(str(post.displayUrl));
  const images = Array.isArray(post.images) ? post.images : [];
  for (const img of images) {
    const u = str(img);
    if (u && looksLikeImageUrl(u)) push(u);
  }
  return out;
}

/** "Sidecar"/"Image"/"Video" (any case) → our normalized post type. */
function mapPostType(raw: Record<string, unknown>): IgParsedPost["type"] {
  const t = (str(raw.type) ?? "").toLowerCase();
  const childCount = Array.isArray(raw.childPosts) ? raw.childPosts.length : 0;
  if (t.includes("sidecar") || t.includes("carousel") || childCount > 1) return "carousel";
  if (t.includes("video") || str(raw.videoUrl)) return "video";
  return "image";
}

/** Defensive parse of one post item (profile latestPosts OR post scraper). */
function parsePost(raw: unknown): IgParsedPost | null {
  const p = asRecord(raw);
  const id = str(p.id) ?? str(p.shortCode) ?? str(p.code) ?? str(p.shortcode);
  if (!id) return null;

  const type = mapPostType(p);
  const imageUrls = collectImageUrls(p);
  const hashtags = (Array.isArray(p.hashtags) ? p.hashtags : [])
    .map((h) => str(h))
    .filter((h): h is string => Boolean(h))
    .slice(0, 30);

  const likes = num(p.likesCount ?? p.likes);
  const comments = num(p.commentsCount ?? p.comments);
  const videoThumb = type === "video" ? str(p.displayUrl) : undefined;

  return {
    id,
    type,
    ...(str(p.caption) && { caption: str(p.caption) }),
    ...(str(p.timestamp) && { timestamp: str(p.timestamp) }),
    ...(likes !== undefined && { likes }),
    ...(comments !== undefined && { comments }),
    hashtags,
    ...(str(p.locationName) && { locationName: str(p.locationName) }),
    imageUrls,
    ...(videoThumb && { videoThumbUrl: videoThumb }),
    ...(str(p.videoUrl) && { videoUrl: str(p.videoUrl) }),
  };
}

/** Collect externalUrl + externalUrls[].url + bioLinks[].url, deduped. */
function collectExternalUrls(d: Record<string, unknown>): string[] {
  const out: string[] = [];
  const push = (u: string | undefined) => {
    if (u && /^https?:\/\//i.test(u) && !out.includes(u)) out.push(u);
  };
  push(str(d.externalUrl));
  for (const e of Array.isArray(d.externalUrls) ? d.externalUrls : []) {
    push(typeof e === "string" ? str(e) : str(asRecord(e).url));
  }
  for (const e of Array.isArray(d.bioLinks) ? d.bioLinks : []) {
    push(str(asRecord(e).url));
  }
  return out.slice(0, 10);
}

/** Full normalizer for one profile dataset item (§1.2 — keep EVERYTHING). */
function parseProfile(item: unknown, requestedHandle: string): IgParsedProfile {
  const d = asRecord(item);

  const posts = (Array.isArray(d.latestPosts) ? d.latestPosts : [])
    .map(parsePost)
    .filter((p): p is IgParsedPost => p !== null)
    .slice(0, MAX_PROFILE_POSTS);

  const verifiedRaw = d.verified ?? d.isVerified;
  const businessPhone =
    str(d.businessPhoneNumber) ??
    str(d.publicPhoneNumber) ??
    str((d as Record<string, unknown>).public_phone_number) ??
    str(d.contactPhoneNumber);
  const businessEmail =
    str(d.businessEmail) ??
    str(d.publicEmail) ??
    str((d as Record<string, unknown>).public_email);

  return {
    handle: str(d.username) ?? requestedHandle,
    ...(str(d.fullName) && { fullName: str(d.fullName) }),
    ...(str(d.biography) && { biography: str(d.biography) }),
    ...(num(d.followersCount) !== undefined && { followersCount: num(d.followersCount) }),
    ...(num(d.postsCount) !== undefined && { postsCount: num(d.postsCount) }),
    ...(typeof verifiedRaw === "boolean" && { verified: verifiedRaw }),
    ...(typeof d.isBusinessAccount === "boolean" && { isBusinessAccount: d.isBusinessAccount }),
    ...(str(d.businessCategoryName) && { businessCategoryName: str(d.businessCategoryName) }),
    externalUrls: collectExternalUrls(d),
    ...(businessPhone && { businessPhone }),
    ...(businessEmail && { businessEmail }),
    ...(str(d.profilePicUrlHD) ?? str(d.profilePicUrl)
      ? { avatarUrl: str(d.profilePicUrlHD) ?? str(d.profilePicUrl) }
      : {}),
    posts,
  };
}

/**
 * Scrape the profile (+ ≤15-post preview) for `rawHandle`, or `null` on any
 * failure (fail-open). `opts.onPhase` receives coarse progress for the chat UI.
 */
export async function runProfileScrape(
  rawHandle: string,
  opts?: { onPhase?: (phase: ApifyPhase) => void; deadline?: number },
): Promise<IgParsedProfile | null> {
  const handle = normalizeIgHandle(rawHandle);
  if (!handle) return fail("invalid instagram handle");

  const items = await runActorDataset(PROFILE_ACTOR, { usernames: [handle] }, opts);
  if (!items || items.length === 0) return fail("empty profile dataset");
  return parseProfile(items[0], handle);
}

/**
 * Scrape the last `limit` posts (with carousel children) for `rawHandle`, or
 * `null` on failure. The post scraper's documented input key is `username` (an
 * array); we also send `usernames` as a harmless fallback because the actor's
 * input shape has drifted across versions and Apify ignores unknown input keys.
 */
export async function runPostsScrape(
  rawHandle: string,
  limit = DEFAULT_POST_LIMIT,
  opts?: { onPhase?: (phase: ApifyPhase) => void; deadline?: number },
): Promise<IgParsedPost[] | null> {
  const handle = normalizeIgHandle(rawHandle);
  if (!handle) return fail("invalid instagram handle");

  const input = { username: [handle], usernames: [handle], resultsLimit: limit };
  const items = await runActorDataset(POST_ACTOR, input, opts);
  if (!items) return null;
  return items
    .map(parsePost)
    .filter((p): p is IgParsedPost => p !== null)
    .slice(0, limit);
}

/**
 * Merge the profile preview's posts with the dedicated post scrape, keyed by
 * post id. The post scrape WINS (richer: carousel children, likes/comments,
 * location) — profile-only posts are appended so nothing is lost.
 */
export function mergeParsedPosts(
  profilePosts: IgParsedPost[],
  scrapedPosts: IgParsedPost[],
): IgParsedPost[] {
  const byId = new Map<string, IgParsedPost>();
  for (const p of scrapedPosts) byId.set(p.id, p);
  const merged = [...scrapedPosts];
  for (const p of profilePosts) {
    if (!byId.has(p.id)) {
      byId.set(p.id, p);
      merged.push(p);
    }
  }
  return merged;
}
