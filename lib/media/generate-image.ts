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
 * фото»): ONE hero + `galleryCount` atmospheric images, generated in parallel
 * off the critical path. Same honesty bounds as the hero (§4.8) — the suffix is
 * appended in code, per image.
 *
 * ONE SUBJECT PER IMAGE. The previous version took a single subject and varied
 * the CAMERA — "extreme close-up", "flat-lay", "angled light" — which changes
 * the framing and not the content, so a site got five pictures of the same
 * thing and owners reported «картинки майже однакові». Different pictures need
 * different subjects, which is why the composition model now proposes a list.
 *
 * Whatever the list does not cover falls back to the vertical's own pool, drawn
 * WITHOUT REPLACEMENT and seeded per site: the old code picked with
 * Math.random() from two prompts, so a four-image gallery routinely drew the
 * same one twice, and two different businesses in one niche got the same
 * background. Fail-open per image: nulls are dropped, a partial set is fine.
 */
export async function generateSiteImages(opts: {
  verticalId?: string;
  /** Distinct subjects, best first — index 0 is the hero. */
  subjects?: string[];
  galleryCount: number;
  /** Per-site seed (brand.designNonce) so the fallback draw differs between
   *  sites and between regenerations instead of being random each call. */
  seed?: number;
}): Promise<{ hero: string | null; gallery: string[] }> {
  const { verticalId, galleryCount, seed = 0 } = opts;
  const prompts = planImagePrompts({
    subjects: opts.subjects,
    pool: getVertical(verticalId).imagePrompts,
    wanted: 1 + Math.max(0, galleryCount),
    seed,
  });
  const results = await Promise.all(
    prompts.map((prompt) => (prompt === null ? null : generateHeroImage({ verticalId, prompt }))),
  );
  const [hero, ...gallery] = results;
  return { hero: hero ?? null, gallery: gallery.filter((u): u is string => Boolean(u)) };
}

/**
 * PURE. Decide the exact prompt for each image, in order — index 0 is the hero.
 *
 * The rules, all of them about not repeating yourself:
 *  - a model-proposed subject is used at most ONCE, in the order given;
 *  - what the subjects do not cover comes from the vertical pool, shuffled by
 *    the seed and consumed without replacement;
 *  - when both run out the slot is `null` — an absent tile beats a duplicate,
 *    and the gallery hides itself below two.
 */
export function planImagePrompts(args: {
  subjects?: string[];
  pool: readonly string[];
  wanted: number;
  seed: number;
}): (string | null)[] {
  const subjects = (args.subjects ?? [])
    .map((s) => s.replace(/[\n\r"«»]/g, " ").trim().slice(0, 140))
    .filter(Boolean);
  const seen = new Set<string>();
  const distinct = subjects.filter((s) => {
    const key = s.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const pool = shuffled(args.pool, args.seed);
  let poolAt = 0;
  return Array.from({ length: Math.max(0, args.wanted) }, (_, i) => {
    if (i < distinct.length) return `${distinct[i]}, ${HERO_PROMPT_SUFFIX}`;
    return poolAt < pool.length ? pool[poolAt++] : null;
  });
}

/** Deterministic shuffle — same seed, same order; different seed, different
 *  order. Mulberry32, the same generator the design axes are seeded with. */
function shuffled<T>(items: readonly T[], seed: number): T[] {
  let a = (seed >>> 0) + 0x6d2b79f5;
  const rand = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export async function generateHeroImage(opts: {
  verticalId?: string;
  /** Model-proposed atmospheric subject for THIS business (English, sanitized here). */
  subject?: string;
  /** A ready-made, already suffix-bounded prompt from the vertical pool. Takes
   *  precedence over `subject` and is never re-suffixed (that would double it). */
  prompt?: string;
}): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("[generateHeroImage] GEMINI_API_KEY missing — skipping generation");
    return null;
  }

  // Subject comes from the site-generation model; the honesty suffix and palette
  // are appended IN CODE, so bounds never depend on the subject's wording.
  const subject = opts.subject?.replace(/[\n\r"«»]/g, " ").trim().slice(0, 140);
  const prompt = subject
    ? `${subject}, ${HERO_PROMPT_SUFFIX}`
    : (opts.prompt ??
      // No subject and no pool pick handed in (single-image callers): draw one.
      getVertical(opts.verticalId).imagePrompts[0]);
  if (!prompt) return null;
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
