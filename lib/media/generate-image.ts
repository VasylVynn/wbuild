import "server-only";
import { getServiceClient } from "@/lib/supabase/server";
import { getVertical, HERO_PROMPT_SUFFIX } from "@/lib/verticals/registry";

/**
 * Runtime hero-image generation (plan 6б, §4.8): for a site with NO owner
 * photos, generate ONE atmospheric, non-literal background via Gemini and store
 * it in our public bucket. The prompts live as data in the vertical registry so
 * they stay tunable and honesty-bounded (never the real venue/products/people).
 *
 * FAIL-OPEN by design: a missing key, timeout, API error, or bad response all
 * resolve to `null` — a site without a background is always better than no site.
 * NO retries (each call costs money) and NO throwing (the caller must not break).
 */

/** True when hero/gallery image generation can actually run (has an API key).
 *  Callers gate the shimmer-placeholder path on this — no key means the
 *  placeholders would never resolve. */
export function isImageGenConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

const MODEL = "gemini-2.5-flash-image";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const BUCKET = "photos";
const TIMEOUT_MS = 25_000;

type GeminiPart = {
  text?: string;
  inlineData?: { data?: string; mimeType?: string };
  inline_data?: { data?: string; mime_type?: string };
};
type GeminiResponse = { candidates?: { content?: { parts?: GeminiPart[] } }[] };

/**
 * Background site-image batch (owner decision, «сайт має бути гарний і без
 * фото»): ONE hero + `galleryCount` atmospheric gallery images, generated in
 * parallel off the critical path. Same honesty bounds as the hero (§4.8):
 * abstractions/textures only — the prompt list varies angle/composition so the
 * gallery doesn't read as one repeated image. Fail-open per image: nulls are
 * dropped, a partial set is fine.
 */
export async function generateSiteImages(opts: {
  verticalId?: string;
  subject?: string;
  palette?: { primary: string; background: string };
  galleryCount: number;
}): Promise<{ hero: string | null; gallery: string[] }> {
  const { verticalId, subject, palette, galleryCount } = opts;
  // Distinct composition twists keep N images from one subject visually varied.
  const twists = [
    "extreme close-up detail, macro texture",
    "wide soft-focus composition with negative space",
    "angled light and long soft shadows",
    "overhead flat-lay perspective",
  ];
  // With a business subject: vary it by twist. Without one: undefined lets
  // generateHeroImage draw from the vertical's own prompt pool (already
  // suffix-bounded — passing it back as `subject` would double the suffix).
  const gallerySubjects = Array.from({ length: Math.max(0, galleryCount) }, (_, i) =>
    subject ? `${subject}, ${twists[i % twists.length]}` : undefined,
  );

  const [hero, ...gallery] = await Promise.all([
    generateHeroImage({ verticalId, subject, palette }),
    ...gallerySubjects.map((s) => generateHeroImage({ verticalId, subject: s, palette })),
  ]);
  return { hero, gallery: gallery.filter((u): u is string => Boolean(u)) };
}

export async function generateHeroImage(opts: {
  verticalId?: string;
  /** Model-proposed atmospheric subject for THIS business (English, sanitized here). */
  subject?: string;
  /** Site theme colors — keeps the image from clashing with the chosen palette. */
  palette?: { primary: string; background: string };
}): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("[generateHeroImage] GEMINI_API_KEY missing — skipping generation");
    return null;
  }

  // Subject comes from the site-generation model; the honesty suffix and palette
  // are appended IN CODE, so bounds never depend on the subject's wording.
  const subject = opts.subject?.replace(/[\n\r"«»]/g, " ").trim().slice(0, 140);
  const fallbacks = getVertical(opts.verticalId).imagePrompts;
  let prompt = subject
    ? `${subject}, ${HERO_PROMPT_SUFFIX}`
    : fallbacks[Math.floor(Math.random() * fallbacks.length)];
  if (!prompt) return null;
  if (opts.palette) {
    prompt += `, color palette inspired by ${opts.palette.primary} and ${opts.palette.background}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "content-type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[generateHeroImage] gemini ${res.status}`);
      return null;
    }

    const json = (await res.json()) as GeminiResponse;
    const parts = json.candidates?.[0]?.content?.parts ?? [];
    const imgPart = parts.find((p) => p.inlineData?.data ?? p.inline_data?.data);
    const data = imgPart?.inlineData?.data ?? imgPart?.inline_data?.data;
    if (!data) {
      console.warn("[generateHeroImage] no image in gemini response");
      return null;
    }
    const mime = imgPart?.inlineData?.mimeType ?? imgPart?.inline_data?.mime_type ?? "image/png";
    const ext = mime.includes("webp") ? "webp" : mime.includes("jpeg") ? "jpg" : "png";
    const buf = Buffer.from(data, "base64");

    const sb = getServiceClient();
    const path = `generated/${crypto.randomUUID()}.${ext}`;
    const { error } = await sb.storage
      .from(BUCKET)
      .upload(path, buf, { contentType: mime, upsert: false });
    if (error) {
      console.warn(`[generateHeroImage] upload failed: ${error.message}`);
      return null;
    }
    const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(path);
    return pub.publicUrl;
  } catch (e) {
    console.warn(`[generateHeroImage] ${e instanceof Error ? e.message : String(e)}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
