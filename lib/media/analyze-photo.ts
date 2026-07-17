import "server-only";
import { getAnthropic, isAnthropicConfigured, GEN_MODEL } from "@/lib/ai/anthropic";
import { isStorageUrl, PHOTO_KINDS, type PhotoKind } from "./media";

/**
 * Photo intelligence (wave G): one vision pass per uploaded photo — classify
 * what it is, judge whether it belongs on the site, propose an honest alt
 * text, and OCR review screenshots verbatim. Reused by the onboarding chat,
 * the editor and the Instagram import (E5) — every incoming photo goes through
 * this single layer.
 *
 * HONESTY RULES (invariant №5 — no invented facts):
 * - The alt describes only what is VISIBLE. Names/brands only when readable in
 *   the image itself.
 * - Review OCR is verbatim, never paraphrased; the extracted text is a
 *   CANDIDATE that the user must explicitly confirm before it becomes a fact.
 *
 * FAIL-OPEN (G5): missing keys, timeouts, API/decode errors → `null`. Callers
 * treat null as "just a photo, no class" and never block the upload on it.
 */

const FETCH_TIMEOUT_MS = 10_000;
const VISION_TIMEOUT_MS = 20_000;
const MAX_BYTES = 8 * 1024 * 1024;

type SupportedMime = "image/jpeg" | "image/png" | "image/gif" | "image/webp";
const SUPPORTED_MIMES: SupportedMime[] = ["image/jpeg", "image/png", "image/gif", "image/webp"];

export type PhotoAnalysis = {
  kind: PhotoKind;
  /** Belongs on a small-business site? false = soft refusal with `reason`. */
  suitable: boolean;
  /** ONE short Ukrainian sentence: why unsuitable, or what the photo shows. */
  reason: string;
  /** Honest Ukrainian alt text (what is visibly in the photo). */
  alt?: string;
  /** kind="review": the review text, OCR'd verbatim. */
  reviewQuote?: string;
  /** kind="review": the author, only when visible in the screenshot. */
  reviewAuthor?: string;
  /** Technical warnings from the classical sharp layer (may be empty). */
  warnings: string[];
};

async function fetchImageBytes(
  url: string,
): Promise<{ buf: Buffer; b64: string; mime: SupportedMime } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const mime = (res.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!SUPPORTED_MIMES.includes(mime as SupportedMime)) return null;
    const declared = Number(res.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > MAX_BYTES) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES) return null;
    return { buf, b64: buf.toString("base64"), mime: mime as SupportedMime };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Classical quality warnings — sharp is a native module, so lazy + fail-open
 * (same contract as the upload route's qualityPass). */
async function technicalWarnings(buf: Buffer): Promise<string[]> {
  try {
    const { analyzeImage } = await import("./process");
    return (await analyzeImage(buf)).warnings;
  } catch {
    return [];
  }
}

const analysisTool = {
  name: "photo_analysis",
  description: "Структурований результат аналізу одного фото для сайту бізнесу.",
  input_schema: {
    type: "object" as const,
    properties: {
      kind: {
        type: "string",
        enum: [...PHOTO_KINDS],
        description:
          "logo — логотип чи графічна вивіска; work — робота/товар/страва; interior — приміщення, фасад чи робоче місце; menu — фото або скріншот меню чи прайсу; review — скріншот відгуку клієнта (переписка, коментар, оцінка); person — людина чи команда; irrelevant — не стосується бізнесу (мем, випадкове фото, чужий контент).",
      },
      suitable: {
        type: "boolean",
        description:
          "Чи придатне фото для сайту цього бізнесу. false лише за РЕАЛЬНОЇ проблеми: сильно розмите/темне, нечитабельне, явно чужий або випадковий контент. Сумніваєшся — true.",
      },
      reason: {
        type: "string",
        description:
          "ОДНЕ коротке речення українською, побутовою мовою: якщо suitable=false — що саме не так; якщо true — що на фото.",
      },
      alt: {
        type: "string",
        description:
          "Alt-текст українською, ≤120 символів: чесний опис того, що ВИДНО на фото. Без вигадок, без оцінок («гарний», «найкращий»), імена/бренди — лише якщо їх видно на самому зображенні.",
      },
      reviewQuote: {
        type: "string",
        description:
          "ЛИШЕ для kind=review: текст відгуку, переписаний ДОСЛІВНО зі скріншота (мовою оригіналу). Нічого не додавай і не перефразовуй. Якщо текст не читається — не заповнюй і постав suitable=false.",
      },
      reviewAuthor: {
        type: "string",
        description:
          "ЛИШЕ для kind=review: імʼя автора, якщо воно ВИДНЕ на скріншоті. Не вигадуй.",
      },
    },
    required: ["kind", "suitable", "reason"],
  },
};

/**
 * One photo → one vision verdict. `null` = analysis unavailable (fail-open);
 * the caller routes the photo as a plain unclassified upload.
 */
export async function analyzePhoto(url: string): Promise<PhotoAnalysis | null> {
  if (!isStorageUrl(url)) return null; // §4.8 — we only analyze our own assets
  if (!isAnthropicConfigured()) return null;

  const img = await fetchImageBytes(url);
  if (!img) return null;

  const warningsP = technicalWarnings(img.buf);

  try {
    const client = getAnthropic();
    const res = await client.messages.create(
      {
        model: GEN_MODEL,
        max_tokens: 700,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: img.mime, data: img.b64 } },
              {
                type: "text",
                text: "Власник малого бізнесу завантажив це фото для свого сайту. Класифікуй його і оціни придатність. Пиши лише те, що бачиш — нічого не вигадуй. Виклич photo_analysis.",
              },
            ],
          },
        ],
        tools: [analysisTool],
        tool_choice: { type: "tool", name: "photo_analysis" },
      },
      { timeout: VISION_TIMEOUT_MS },
    );
    const tool = res.content.find((c) => c.type === "tool_use");
    if (!tool || tool.type !== "tool_use") return null;
    const input = tool.input as Partial<PhotoAnalysis> & { kind?: string };
    if (!input.kind || !PHOTO_KINDS.includes(input.kind as PhotoKind)) return null;
    if (typeof input.suitable !== "boolean") return null;

    const clean = (s: unknown, max: number) =>
      typeof s === "string" && s.trim() ? s.trim().slice(0, max) : undefined;
    const isReview = input.kind === "review";
    return {
      kind: input.kind as PhotoKind,
      suitable: input.suitable,
      reason: clean(input.reason, 200) ?? "",
      alt: clean(input.alt, 200),
      // Review fields only make sense for review screenshots — a stray quote
      // on another kind must never become a testimonial candidate.
      ...(isReview && { reviewQuote: clean(input.reviewQuote, 600) }),
      ...(isReview && { reviewAuthor: clean(input.reviewAuthor, 80) }),
      warnings: await warningsP,
    };
  } catch (e) {
    console.warn(`[analyze-photo] vision failed: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}
