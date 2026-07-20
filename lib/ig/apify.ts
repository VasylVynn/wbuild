import "server-only";
import { normalizeIgHandle } from "@/lib/blocks/contact-links";

/**
 * Instagram import (wave E): pull a public profile — bio, avatar and recent
 * post images — from the Apify actor `apify/instagram-profile-scraper` so the
 * onboarding chat can seed a site from a handle the owner already has.
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
 * caller treats `null` as "no Instagram data" and continues onboarding by hand.
 * The token and any token-bearing URL are NEVER logged.
 *
 * Cost: an Instagram profile scrape runs ~$0.01–0.05 per onboarding.
 */

const APIFY_BASE = "https://api.apify.com/v2";
const ACTOR = "apify~instagram-profile-scraper";

const POLL_INTERVAL_MS = 3_000;
const DEFAULT_TIMEOUT_MS = 150_000;
const DEFAULT_MAX_POSTS = 15;

// Per-request caps so a hung socket can never blow past the overall deadline
// (same fail-open reasoning as lib/media/analyze-photo.ts).
const START_TIMEOUT_MS = 20_000;
const POLL_TIMEOUT_MS = 15_000;
const DATASET_TIMEOUT_MS = 30_000;

// Terminal run statuses that mean "no data is coming".
const FAILED_STATUSES = new Set(["FAILED", "ABORTED", "TIMED-OUT"]);

export type IgPost = { imageUrl: string; caption?: string };
export type IgProfile = {
  handle: string;
  fullName?: string;
  bio?: string;
  avatarUrl?: string;
  posts: IgPost[];
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

/** A `url` field is only trusted as an image when it looks like an image CDN. */
function looksLikeImageUrl(u: string): boolean {
  return /\.(jpe?g|png|webp|gif)(\?|$)/i.test(u) || /cdninstagram|fbcdn/i.test(u);
}

/** Post image: displayUrl → images[0] → url (only if it looks like an image). */
function postImage(post: Record<string, unknown>): string | undefined {
  const direct = str(post.displayUrl);
  if (direct) return direct;
  const images = Array.isArray(post.images) ? post.images : [];
  const firstImage = str(images[0]);
  if (firstImage) return firstImage;
  const url = str(post.url);
  if (url && looksLikeImageUrl(url)) return url;
  return undefined;
}

/**
 * Defensive parse of one dataset item. The actor's output shape drifts between
 * versions, so everything is read as optional/unknown and coerced.
 */
function parseProfile(item: unknown, requestedHandle: string, maxPosts: number): IgProfile {
  const data = asRecord(item);

  const posts: IgPost[] = [];
  // Reels/videos are kept too (via their cover image) — do NOT filter by type.
  const rawPosts = Array.isArray(data.latestPosts) ? data.latestPosts : [];
  for (const raw of rawPosts) {
    if (posts.length >= maxPosts) break;
    const imageUrl = postImage(asRecord(raw));
    if (!imageUrl || !imageUrl.startsWith("https:")) continue;
    const caption = str(asRecord(raw).caption);
    posts.push(caption ? { imageUrl, caption } : { imageUrl });
  }

  return {
    handle: str(data.username) ?? requestedHandle,
    fullName: str(data.fullName),
    bio: str(data.biography),
    avatarUrl: str(data.profilePicUrlHD) ?? str(data.profilePicUrl),
    posts,
  };
}

/**
 * Fetch a normalized Instagram profile for `rawHandle`, or `null` on any
 * failure (fail-open). `opts.onPhase` receives coarse progress for the chat UI.
 */
export async function fetchInstagramProfile(
  rawHandle: string,
  opts?: { maxPosts?: number; onPhase?: (phase: "starting" | "scraping" | "fetching") => void },
): Promise<IgProfile | null> {
  const handle = normalizeIgHandle(rawHandle);
  if (!handle) return fail("invalid instagram handle");

  const token = process.env.APIFY_API_TOKEN?.trim();
  if (!token) return fail("APIFY_API_TOKEN not set");

  const maxPosts = opts?.maxPosts ?? DEFAULT_MAX_POSTS;
  const deadline = Date.now() + resolveTimeoutMs();

  try {
    // 1) Start the async run.
    opts?.onPhase?.("starting");
    const startRes = await timedFetch(
      `${APIFY_BASE}/acts/${ACTOR}/runs?token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usernames: [handle] }),
      },
      START_TIMEOUT_MS,
    );
    if (!startRes.ok) return fail(`start run failed: HTTP ${startRes.status}`);
    const startData = asRecord(asRecord(await startRes.json()).data);
    const runId = str(startData.id);
    const datasetId = str(startData.defaultDatasetId);
    if (!runId || !datasetId) return fail("start run returned no run id");

    // 2) Poll the run until it succeeds, fails, or we hit the deadline.
    let announced = false;
    for (;;) {
      if (Date.now() >= deadline) return fail("run deadline exceeded");
      if (!announced) {
        opts?.onPhase?.("scraping");
        announced = true;
      }
      const statusRes = await timedFetch(
        `${APIFY_BASE}/actor-runs/${runId}?token=${token}`,
        {},
        POLL_TIMEOUT_MS,
      );
      if (!statusRes.ok) return fail(`poll failed: HTTP ${statusRes.status}`);
      const status = str(asRecord(asRecord(await statusRes.json()).data).status) ?? "";
      if (status === "SUCCEEDED") break;
      if (FAILED_STATUSES.has(status)) return fail(`run failed: ${status}`);
      await sleep(POLL_INTERVAL_MS);
    }

    // 3) Fetch the dataset and parse the first (only) profile item.
    opts?.onPhase?.("fetching");
    const dsRes = await timedFetch(
      `${APIFY_BASE}/datasets/${datasetId}/items?token=${token}&clean=true&format=json`,
      {},
      DATASET_TIMEOUT_MS,
    );
    if (!dsRes.ok) return fail(`dataset fetch failed: HTTP ${dsRes.status}`);
    const items = await dsRes.json();
    if (!Array.isArray(items) || items.length === 0) return fail("empty dataset");

    return parseProfile(items[0], handle, maxPosts);
  } catch {
    // Network error, abort/timeout, or malformed JSON — stay fail-open. The
    // error is not logged: fetch errors can embed the token-bearing URL.
    return fail("instagram import failed");
  }
}
