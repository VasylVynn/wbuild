import { z } from "zod";

/**
 * Owner-uploaded media (§4.8 honesty invariant). Only REAL uploaded photos ever
 * reach a generated site — the AI model never sees or produces image URLs. Every
 * URL is validated to live under our own public Storage bucket, so a tampered
 * client can't smuggle an arbitrary external image into a site.
 *
 * `generatedHero` is the ONE exception to "only real uploads": an atmospheric,
 * non-literal background we generate for a site with no owner photos (§4.8). It
 * still lives under our own bucket, so the same storage-prefix guard applies.
 */
export type SiteMedia = {
  logoUrl?: string;
  photos: string[];
  generatedHero?: string;
  photoMeta?: PhotoMeta[];
  /** Request-scoped signal (never persisted): N generated gallery images are
   *  being produced in the background — assemble() keeps a gallery with that
   *  many shimmer placeholders instead of dropping it (owner decision: the
   *  site must look good even with zero uploaded photos). */
  generatedPending?: number;
};

/**
 * What a photo IS, as judged by the vision layer (wave G). The vocabulary is
 * shared by the analyzer, the chat routing and the generation alt-threading —
 * one enum, no parallel string sets.
 */
export const PHOTO_KINDS = [
  "logo", // логотип / вивіска-графіка
  "work", // робота, товар, страва — предметне фото
  "interior", // приміщення, фасад, робоче місце
  "menu", // меню або прайс (фото/скріншот)
  "review", // скріншот відгуку клієнта
  "person", // людина або команда
  "irrelevant", // не стосується бізнесу
] as const;
export type PhotoKind = (typeof PHOTO_KINDS)[number];

/**
 * The agent's per-image verdict on how the deterministic assembler should use a
 * photo (refactor 04 §1 `set_media_role`). `site` → eligible for the gallery/hero;
 * `text_source` → an info image (prices/hours/phone printed on it) that feeds the
 * dossier but is EXCLUDED from the visible gallery; `logo` → the brand mark;
 * `hidden` → kept but never rendered. The model only ever sees id→role, never URLs.
 */
export const PHOTO_ROLES = ["site", "text_source", "logo", "hidden"] as const;
export type PhotoRole = (typeof PHOTO_ROLES)[number];

/**
 * Structured requisite candidates the vision layer read off a photo (refactor
 * §1.4). These are UNCONFIRMED — phones/addresses printed on a post become facts
 * only after the owner's one-tap confirmation (invariant 5). All fields are
 * empty-able so an image with no printed info yields an all-empty object.
 */
export type ExtractedInfo = {
  phones: string[];
  prices: { name: string; price: string }[];
  addresses: string[];
  hours?: string;
  promos: string[];
};

/**
 * Per-photo result of the vision analysis, keyed by storage URL. `alt` is a
 * human-written-quality Ukrainian description of what is actually IN the photo
 * (never invented) — generation prefers it over the deterministic name+city alt.
 *
 * The extended fields (refactor §1.4) let generation cast photos by id and let
 * the dossier mine text-heavy images for requisites without the model ever
 * seeing a URL:
 * - `id`         stable short id (see photoIdFor) — the handle the model casts by.
 * - `ocrText`    ALL visible text on the image, verbatim ("" when none).
 * - `textHeavy`  overlay-text-dominant ⇒ poor SITE photo, good INFO source.
 * - `extractedInfo` requisite candidates read off the image.
 * - `useOnSite`  vision verdict: suitable as an actual site photo.
 * - `sourceCaption` the IG post caption attached to this photo at import.
 * - `role`       the agent's persisted per-image verdict (set_media_role).
 */
export type PhotoMeta = {
  url: string;
  /** Stable short id (photoIdFor(url)); optional so pre-refactor rows stay valid. */
  id?: string;
  kind?: PhotoKind;
  alt?: string;
  ocrText?: string;
  textHeavy?: boolean;
  extractedInfo?: ExtractedInfo;
  useOnSite?: boolean;
  sourceCaption?: string;
  role?: PhotoRole;
};

/**
 * Public URL prefix for the "photos" bucket, derived from the Supabase URL.
 * Returns "" when the URL is unset (dev without keys) — the empty prefix is
 * treated as "no URL can validate" by isStorageUrl, which is the safe default.
 */
export function storagePublicPrefix(): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return "";
  return `${base.replace(/\/$/, "")}/storage/v1/object/public/photos/`;
}

/** A string that points at an asset in OUR public Storage bucket. */
export function isStorageUrl(url: unknown): url is string {
  if (typeof url !== "string") return false;
  const prefix = storagePublicPrefix();
  // Guard the empty prefix: "".startsWith("") is true for every string.
  return prefix !== "" && url.startsWith(prefix);
}

/**
 * Stable per-photo id = first 10 hex chars of SHA-1 of the storage URL. It is
 * derived deterministically so the SAME photo always yields the SAME id across
 * turns — generation casts photos by id ("hero: photo_ab12cd34ef") and
 * set_media_role writes an id→role map, never touching URLs. Because it's a pure
 * function of the URL, callers can always recover an entry's id with
 * `m.id ?? photoIdFor(m.url)` even for legacy rows that never stored one.
 *
 * Implemented with a self-contained synchronous SHA-1 (no node:crypto) because
 * this module is imported by client components — a `require("crypto")` here would
 * break the browser bundle. Verified byte-for-byte against node's crypto.
 */
export function photoIdFor(url: string): string {
  return sha1Hex(url).slice(0, 10);
}

/** Synchronous SHA-1 over a UTF-8 string → 40-char lowercase hex digest. */
function sha1Hex(input: string): string {
  const bytes = Array.from(new TextEncoder().encode(input));
  const bitLen = bytes.length * 8; // URLs are short — well under 2^32 bits
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  // 64-bit big-endian length: high 32 bits are always 0 at our input sizes.
  bytes.push(0, 0, 0, 0);
  for (let i = 3; i >= 0; i--) bytes.push((bitLen >>> (i * 8)) & 0xff);

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;
  const rotl = (n: number, s: number) => ((n << s) | (n >>> (32 - s))) >>> 0;
  const w = new Array<number>(80);

  for (let chunk = 0; chunk < bytes.length; chunk += 64) {
    for (let i = 0; i < 16; i++) {
      const j = chunk + i * 4;
      w[i] = ((bytes[j] << 24) | (bytes[j + 1] << 16) | (bytes[j + 2] << 8) | bytes[j + 3]) >>> 0;
    }
    for (let i = 16; i < 80; i++) w[i] = rotl(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    for (let i = 0; i < 80; i++) {
      let f: number;
      let k: number;
      if (i < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (i < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (i < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }
      const t = (rotl(a, 5) + f + e + k + w[i]) >>> 0;
      e = d;
      d = c;
      c = rotl(b, 30);
      b = a;
      a = t;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }

  const hex = (n: number) => `0000000${(n >>> 0).toString(16)}`.slice(-8);
  return hex(h0) + hex(h1) + hex(h2) + hex(h3) + hex(h4);
}

const storageUrl = z.string().refine(isStorageUrl, { message: "not a storage url" });

/** Photos the owner may attach to a site (raised from 3 in wave G, 8 → 12 in
 * the generation refactor — an IG deep scrape yields far more than 8 keepers
 * and silently discarding a third of the owner's photos was gap #5). */
export const MAX_PHOTOS = 12;

/**
 * Cap on photoMeta entries. Larger than `photos` on purpose: an IG deep scrape
 * imports up to ~30 images, and `text_source` photos carry meta (they feed the
 * dossier) without ever entering the visible `photos` array — so the metadata
 * inventory legitimately runs well past photos+logo (refactor §1.3/§2.1).
 */
export const MAX_PHOTO_META = 40;

/** Structured requisite candidates read off one image (refactor §1.4). */
const extractedInfoSchema = z.object({
  phones: z.array(z.string()).default([]),
  prices: z.array(z.object({ name: z.string(), price: z.string() })).default([]),
  addresses: z.array(z.string()).default([]),
  hours: z.string().optional(),
  promos: z.array(z.string()).default([]),
});

/** Strict media schema: ≤MAX_PHOTOS photos, every URL under our Storage bucket. */
export const mediaSchema = z.object({
  logoUrl: storageUrl.optional(),
  photos: z.array(storageUrl).max(MAX_PHOTOS).default([]),
  generatedHero: storageUrl.optional(),
  // One meta entry per analyzed image (logo + site + text_source), keyed by URL.
  // `.passthrough()` so a NEW analyzePhoto field added by a later wave survives a
  // round-trip through the DB even before this schema names it (refactor §1.4:
  // "persist ALL of it" — the old schema silently dropped suitable/reason).
  photoMeta: z
    .array(
      z
        .object({
          url: storageUrl,
          id: z.string().max(32).optional(),
          kind: z.enum(PHOTO_KINDS).optional(),
          alt: z.string().max(200).optional(),
          ocrText: z.string().max(4000).optional(),
          textHeavy: z.boolean().optional(),
          extractedInfo: extractedInfoSchema.optional(),
          useOnSite: z.boolean().optional(),
          sourceCaption: z.string().max(2200).optional(),
          role: z.enum(PHOTO_ROLES).optional(),
        })
        .passthrough(),
    )
    .max(MAX_PHOTO_META)
    .optional(),
});

/**
 * Coerce untrusted input to safe media. Invalid input (bad/foreign URLs, too
 * many photos) collapses to `{ photos: [] }` rather than throwing — used on the
 * generation path where media is optional and must never block a site.
 */
export function sanitizeMedia(input: unknown): SiteMedia {
  const parsed = mediaSchema.safeParse(input);
  if (!parsed.success) return { photos: [] };
  return {
    ...(parsed.data.logoUrl && { logoUrl: parsed.data.logoUrl }),
    photos: parsed.data.photos,
    ...(parsed.data.generatedHero && { generatedHero: parsed.data.generatedHero }),
    ...(parsed.data.photoMeta?.length && { photoMeta: parsed.data.photoMeta as PhotoMeta[] }),
  };
}
