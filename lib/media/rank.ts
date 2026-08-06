import type { PhotoMeta } from "./media";

/**
 * Photo vetting (plan «якість генерації» §1, wave A). The vision layer scores
 * every image (`siteQuality`, `burnedText`, `heroCandidate`, `subjectCentered`)
 * and the classical sharp layer adds blur/darkness warnings — this module is the
 * ONE place that turns those signals into decisions:
 *
 * - which photos survive the MAX_PHOTOS cut (feed order → quality order),
 * - which photo becomes the hero when the model casts none,
 * - whether the site has enough real photos to skip AI image generation.
 *
 * Pure and dependency-free (types only) so it is unit-testable and safe to
 * import from both the generation path and the API routes.
 */

/**
 * Score for a photo the vision layer never rated — legacy rows, owner uploads
 * analyzed before this wave, or an analysis that failed open. The benefit of the
 * doubt on purpose: an unrated photo must never sort below a measurably bad one,
 * and must never be the reason we start generating fake imagery.
 */
export const DEFAULT_SITE_QUALITY = 5;

/** The bar for "this photo can carry a site" — shared by ranking and the trigger. */
export const USABLE_SITE_QUALITY = 5;

/** Below this many usable photos a site gets generated imagery (plan §1.5). */
export const MIN_USABLE_PHOTOS = 3;

/** Burned-in text/stickers/collage: usable, but never a first pick. */
const BURNED_TEXT_PENALTY = 3;

/** Per classical warning that describes bad PIXELS (blur / darkness). */
const WARNING_PENALTY = 2;

/**
 * Warnings from `analyzeImage` (lib/media/process.ts) that mean the pixels are
 * degraded. Matched by word stem because those strings are owner-facing
 * Ukrainian copy, not codes — «Фото трохи розмите…», «Фото темнувате…». The
 * third warning ("замалої роздільності") is deliberately NOT penalized: small
 * is a display problem, not a photographic one, and the wireframe scales.
 */
const DEGRADED_PIXELS_RE = /розмит|темнув/i;

/** Photos the assembler is allowed to render at all (03 §2.1 casting rules). */
export function isEligiblePhoto(m: PhotoMeta | undefined): boolean {
  if (!m) return true; // pre-refactor uploads carry no meta — always eligible
  if (m.role === "text_source" || m.role === "hidden") return false;
  return m.useOnSite !== false;
}

/** Vision score clamped to 0…10, or the neutral default when unrated. */
function baseQuality(m: PhotoMeta | undefined): number {
  const q = m?.siteQuality;
  if (typeof q !== "number" || !Number.isFinite(q)) return DEFAULT_SITE_QUALITY;
  return Math.min(10, Math.max(0, q));
}

/**
 * Ranking score: the vision quality, minus what the pixels and overlays cost.
 * Can go negative — that is the point, a blurry meme collage must lose to
 * anything else the owner has.
 */
export function photoScore(m: PhotoMeta | undefined): number {
  let score = baseQuality(m);
  if (m?.burnedText === true) score -= BURNED_TEXT_PENALTY;
  for (const w of m?.warnings ?? []) {
    if (DEGRADED_PIXELS_RE.test(w)) score -= WARNING_PENALTY;
  }
  return score;
}

/** Descending-quality comparator (best first). */
export function comparePhotoQuality(a: PhotoMeta | undefined, b: PhotoMeta | undefined): number {
  return photoScore(b) - photoScore(a);
}

/**
 * Hero fitness, best first: an explicit `heroCandidate` outranks everything,
 * then the ranking score (so a burned-text or blurry photo can't win on its raw
 * vision number alone), then a centered subject as the tie-break.
 */
export function compareHeroFitness(a: PhotoMeta | undefined, b: PhotoMeta | undefined): number {
  const flag = Number(b?.heroCandidate === true) - Number(a?.heroCandidate === true);
  if (flag !== 0) return flag;
  const quality = photoScore(b) - photoScore(a);
  if (quality !== 0) return quality;
  return Number(b?.subjectCentered === true) - Number(a?.subjectCentered === true);
}

/** url → meta lookup, tolerant of a missing/short meta list. */
export function metaIndex(meta: PhotoMeta[] | undefined): Map<string, PhotoMeta> {
  return new Map((meta ?? []).map((m) => [m.url, m]));
}

/**
 * Best photos first. Ties keep the incoming order (an Instagram feed is roughly
 * newest-first, which is a sane secondary signal), so this is a stable sort done
 * explicitly rather than leaning on the engine's guarantee.
 */
export function rankPhotoUrls(urls: string[], meta: PhotoMeta[] | Map<string, PhotoMeta>): string[] {
  const byUrl = meta instanceof Map ? meta : metaIndex(meta);
  return urls
    .map((url, i) => ({ url, i }))
    .sort((a, b) => comparePhotoQuality(byUrl.get(a.url), byUrl.get(b.url)) || a.i - b.i)
    .map((x) => x.url);
}

/**
 * The photo to put in the hero when the model cast none. Order in the incoming
 * list is the final tie-break, so a photo-less business still gets `undefined`
 * and the generated atmospheric hero takes over downstream.
 */
export function pickHeroUrl(
  urls: string[],
  meta: PhotoMeta[] | Map<string, PhotoMeta>,
): string | undefined {
  const byUrl = meta instanceof Map ? meta : metaIndex(meta);
  let best: string | undefined;
  for (const url of urls) {
    if (best === undefined) {
      best = url;
      continue;
    }
    if (compareHeroFitness(byUrl.get(url), byUrl.get(best)) < 0) best = url;
  }
  return best;
}

/** A photo good enough that the site does not need generated imagery. */
export function isUsablePhoto(m: PhotoMeta | undefined): boolean {
  if (!isEligiblePhoto(m)) return false;
  // No score at all → usable. Never let a missing signal buy an AI image.
  if (typeof m?.siteQuality !== "number") return true;
  return m.siteQuality >= USABLE_SITE_QUALITY;
}

/** How many of a site's photos clear the usability bar. */
export function usablePhotoCount(media: {
  photos?: string[];
  photoMeta?: PhotoMeta[];
}): number {
  const byUrl = metaIndex(media.photoMeta);
  return (media.photos ?? []).filter((url) => isUsablePhoto(byUrl.get(url))).length;
}
