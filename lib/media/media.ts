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
export type SiteMedia = { logoUrl?: string; photos: string[]; generatedHero?: string };

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

const storageUrl = z.string().refine(isStorageUrl, { message: "not a storage url" });

/** Strict media schema: ≤3 photos, every URL under our Storage bucket. */
export const mediaSchema = z.object({
  logoUrl: storageUrl.optional(),
  photos: z.array(storageUrl).max(3).default([]),
  generatedHero: storageUrl.optional(),
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
  };
}
