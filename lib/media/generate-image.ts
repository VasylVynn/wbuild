import "server-only";
import { getServiceClient } from "@/lib/supabase/server";
import { getVertical } from "@/lib/verticals/registry";

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

export async function generateHeroImage(verticalId?: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("[generateHeroImage] GEMINI_API_KEY missing — skipping generation");
    return null;
  }

  const prompts = getVertical(verticalId).imagePrompts;
  if (!prompts.length) return null;
  const prompt = prompts[Math.floor(Math.random() * prompts.length)];

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
