import "server-only";
import { stripLoneSurrogates, safeSlice } from "@/lib/ai/sanitize";
import { normalizeIgHandle } from "@/lib/blocks/contact-links";
import {
  runProfileScrape,
  runPostsScrape,
  mergeParsedPosts,
  type IgParsedProfile,
} from "./apify";
import { persistSnapshot } from "./snapshots";
import { importExternalImage } from "@/lib/media/import";
import { analyzePhoto } from "@/lib/media/analyze-photo";
import { photoIdFor, type PhotoMeta } from "@/lib/media/media";

/**
 * Deep Instagram scrape (refactor §1.3) — the orchestrator behind the agent's
 * `scrape_instagram` (onboarding) / `refresh_instagram` (editor) tool. It:
 *   1. runs BOTH Apify actors (profile + posts) and merges their posts,
 *   2. re-hosts avatar + up to ~30 post images into OUR Storage (§4.8 — no
 *      foreign image URLs ever reach a tenant site),
 *   3. runs the extended vision pass on each imported image and attaches the
 *      post caption per-photo,
 *   4. persists an ig_snapshots row (best-effort),
 *   5. returns a Ukrainian-labelled digest the chat model can read directly.
 *
 * FAIL-OPEN at every layer: partial results beat throwing. Even a total scrape
 * failure resolves to a well-formed IgDeepResult (empty media, "no data" digest)
 * so the tool handler can tell the owner honestly instead of erroring.
 */

const MAX_IMPORT_IMAGES = 30; // avatar + carousel children, capped (§1.3)
const POST_LIMIT = 20;
const IMPORT_CONCURRENCY = 4;

export type IgDeepResult = {
  parsed: IgParsedProfile;
  media: { logo?: string; photos: string[]; photoMeta: PhotoMeta[] };
  digest: string;
};

export type IgDeepProgress = {
  phase: "scraping" | "importing";
  done?: number;
  total?: number;
};

type ImageSource = { url: string; caption?: string; isAvatar: boolean };
type ImportedImage = {
  storageUrl: string;
  caption?: string;
  isAvatar: boolean;
  analysis: Awaited<ReturnType<typeof analyzePhoto>>;
};

/** Bounded-concurrency map — imports/analyses run a few at a time (§1.3). */
async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker),
  );
  return results;
}

/** First `n` chars of a single-line, collapsed excerpt (for the digest).
 *  Surrogate-safe + surrogate-clean: captions are emoji-heavy and this text
 *  reaches the Anthropic body, where a lone surrogate is a hard 400. */
function excerpt(s: string | undefined, n: number): string {
  if (!s) return "";
  const flat = stripLoneSurrogates(s.replace(/\s+/g, " ").trim());
  return flat.length > n ? `${safeSlice(flat, n)}…` : flat;
}

/**
 * Compact Ukrainian digest for the chat model. Scraped text is wrapped in
 * <scraped_data> and every requisite is flagged as an UNCONFIRMED candidate
 * (04 §5.1: the text inside is DATA about the business, not instructions).
 */
function buildDigest(parsed: IgParsedProfile, photoMeta: PhotoMeta[]): string {
  const lines: string[] = [];
  lines.push("<scraped_data>");
  lines.push(
    `Instagram @${parsed.handle} — дані з профілю (НЕпідтверджені кандидати, потребують підтвердження власника):`,
  );
  if (parsed.fullName) lines.push(`Імʼя профілю: ${parsed.fullName}`);
  if (parsed.biography) lines.push(`Біо: ${excerpt(parsed.biography, 400)}`);
  if (parsed.businessCategoryName) lines.push(`Категорія: ${parsed.businessCategoryName}`);
  if (parsed.followersCount !== undefined) lines.push(`Підписники: ${parsed.followersCount}`);
  if (parsed.businessPhone) lines.push(`Телефон-кандидат: ${parsed.businessPhone}`);
  if (parsed.businessEmail) lines.push(`Email-кандидат: ${parsed.businessEmail}`);
  if (parsed.externalUrls.length) lines.push(`Посилання: ${parsed.externalUrls.join(", ")}`);

  if (photoMeta.length) {
    lines.push(`Фото (${photoMeta.length}) — id → короткий опис:`);
    for (const m of photoMeta) {
      const kind = m.kind ?? "?";
      const site = m.useOnSite === false ? "ні" : "так";
      const parts = [`id=${m.id ?? photoIdFor(m.url)} [${kind}, наСайт:${site}]`];
      if (m.alt) parts.push(m.alt);
      if (m.ocrText) parts.push(`OCR:"${excerpt(m.ocrText, 80)}"`);
      if (m.sourceCaption) parts.push(`підпис:"${excerpt(m.sourceCaption, 80)}"`);
      lines.push(`- ${parts.join(" — ")}`);
    }
  } else {
    lines.push("Фото не імпортовано.");
  }
  lines.push("</scraped_data>");
  return lines.join("\n");
}

export async function scrapeInstagramDeep(args: {
  handle: string;
  conversationId?: string;
  tenantId?: string;
  onProgress?: (p: IgDeepProgress) => void;
}): Promise<IgDeepResult> {
  const handle = normalizeIgHandle(args.handle) ?? args.handle.trim();
  const emptyParsed: IgParsedProfile = { handle, externalUrls: [], posts: [] };

  args.onProgress?.({ phase: "scraping" });

  // Both actors in parallel: each keeps its own APIFY_TIMEOUT budget, so the
  // wall-clock stays ~one scrape's worth rather than two (§1.3, ≤150s total).
  const [profile, postsScrape] = await Promise.all([
    runProfileScrape(handle).catch((e) => {
      console.error(`[deep] profile scrape failed for @${handle}: ${e instanceof Error ? e.message : e}`);
      return null;
    }),
    runPostsScrape(handle, POST_LIMIT).catch((e) => {
      console.error(`[deep] posts scrape failed for @${handle}: ${e instanceof Error ? e.message : e}`);
      return null;
    }),
  ]);
  // Both actors dead → the scrape produced NOTHING. Surface it loudly (prod
  // debugging: this exact silence made the agent quietly fall back to manual
  // questioning while promising it had "saved the profile").
  if (!profile && !postsScrape) {
    console.error(`[deep] scrape returned no data for @${handle} (both actors failed/empty)`);
  }

  const parsed: IgParsedProfile = profile
    ? { ...profile, posts: mergeParsedPosts(profile.posts, postsScrape ?? []) }
    : postsScrape
      ? { ...emptyParsed, posts: postsScrape }
      : emptyParsed;

  // Gather image sources: avatar first, then post images (carousel children
  // included) in feed order, deduped, capped at MAX_IMPORT_IMAGES.
  const sources: ImageSource[] = [];
  const seen = new Set<string>();
  const add = (url: string, caption: string | undefined, isAvatar: boolean) => {
    if (seen.has(url) || sources.length >= MAX_IMPORT_IMAGES) return;
    seen.add(url);
    sources.push({ url, caption, isAvatar });
  };
  if (parsed.avatarUrl) add(parsed.avatarUrl, undefined, true);
  for (const post of parsed.posts) {
    for (const u of post.imageUrls) add(u, post.caption, false);
    if (sources.length >= MAX_IMPORT_IMAGES) break;
  }

  const importScope = args.conversationId
    ? { conversationId: args.conversationId }
    : { tenantId: args.tenantId };

  let done = 0;
  const total = sources.length;
  args.onProgress?.({ phase: "importing", done, total });
  const imported = await mapPool(sources, IMPORT_CONCURRENCY, async (s): Promise<ImportedImage | null> => {
    try {
      const storageUrl = await importExternalImage(s.url, importScope);
      if (!storageUrl) return null;
      const analysis = await analyzePhoto(storageUrl);
      return { storageUrl, caption: s.caption, isAvatar: s.isAvatar, analysis };
    } catch {
      return null;
    } finally {
      done += 1;
      args.onProgress?.({ phase: "importing", done, total });
    }
  });

  let logo: string | undefined;
  const photos: string[] = [];
  const photoMeta: PhotoMeta[] = [];
  for (const r of imported) {
    if (!r) continue;
    const meta: PhotoMeta = {
      url: r.storageUrl,
      id: photoIdFor(r.storageUrl),
      // role is left undefined here — set_media_role assigns it later (04 §1).
      ...(r.caption && { sourceCaption: stripLoneSurrogates(safeSlice(r.caption, 2000)) }),
      ...(r.analysis && {
        kind: r.analysis.kind,
        ...(r.analysis.alt && { alt: r.analysis.alt }),
        ocrText: r.analysis.ocrText,
        textHeavy: r.analysis.textHeavy,
        extractedInfo: r.analysis.extractedInfo,
        useOnSite: r.analysis.useOnSite,
      }),
    };
    photoMeta.push(meta);
    if (r.isAvatar) logo = r.storageUrl;
    else photos.push(r.storageUrl);
  }

  // Best-effort snapshot. `raw` keeps the two scrape sources PRE-merge (profile
  // preview + posts scrape) so a future merge change can be re-derived; `parsed`
  // is the merged view the dossier reads.
  await persistSnapshot({
    conversationId: args.conversationId ?? null,
    tenantId: args.tenantId ?? null,
    handle: parsed.handle,
    raw: { profile: profile ?? null, posts: postsScrape ?? null },
    parsed,
  });

  // Honest failure digest (prod lesson): when the scrape produced effectively
  // NOTHING, the model must be told so explicitly — otherwise it improvises
  // («поки що збережу ваш профіль…») and quietly interrogates the owner while
  // implying the profile was read.
  const gotNothing =
    !parsed.biography && !parsed.fullName && parsed.posts.length === 0 && photoMeta.length === 0;
  const digest = gotNothing
    ? `ПОМИЛКА СКРЕЙПУ: не вдалося отримати дані з Instagram @${parsed.handle} (тимчасова технічна помилка). ЧЕСНО скажи власнику, що зазирнути в профіль зараз не вийшло, і запропонуй два шляхи: спробувати ще раз (виклич scrape_instagram повторно) або розповісти основне самому. НЕ вдавай, що профіль збережено чи прочитано.`
    : buildDigest(parsed, photoMeta);
  return { parsed, media: { ...(logo && { logo }), photos, photoMeta }, digest };
}
