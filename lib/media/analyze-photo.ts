import "server-only";
import { stripLoneSurrogates, safeSlice } from "@/lib/ai/sanitize";
import { getAnthropic, isAnthropicConfigured, VISION_MODEL } from "@/lib/ai/anthropic";
import { isStorageUrl, PHOTO_KINDS, type PhotoKind, type ExtractedInfo } from "./media";
import { DEFAULT_SITE_QUALITY } from "./rank";
import { extractPalette } from "./palette";

/**
 * Photo intelligence (wave G, extended by refactor §1.4): one vision pass per
 * image. It classifies what the photo is, judges whether it belongs on the site,
 * proposes an honest alt text, OCRs ALL visible text verbatim, flags text-heavy
 * "info" images, and extracts requisite candidates (phones/prices/addresses/
 * hours/promos) printed on the image. Reused by the onboarding chat, the editor
 * and the Instagram deep scrape — every incoming photo goes through this layer.
 *
 * HONESTY RULES (invariant №5 — no invented facts):
 * - The alt and OCR describe only what is VISIBLE. Names/brands/numbers only
 *   when readable in the image itself; OCR and extractedInfo are copied verbatim,
 *   never paraphrased or guessed.
 * - Everything extracted is a CANDIDATE the owner must confirm before it becomes
 *   a fact (the confirmation card / dossier candidates gate still applies).
 *
 * FAIL-OPEN (G5): missing keys, timeouts, API/decode errors → `null`. Callers
 * treat null as "just a photo, no class" and never block the upload on it.
 */

const FETCH_TIMEOUT_MS = 10_000;
const VISION_TIMEOUT_MS = 25_000;
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
  /** ALL visible text on the image, verbatim ("" when there is none). */
  ocrText: string;
  /** Overlay-text-dominant ⇒ poor SITE photo but a valuable INFO source. */
  textHeavy: boolean;
  /** Requisite candidates read off the image (§1.4). Empty-able. */
  extractedInfo: ExtractedInfo;
  /** Vision verdict: suitable as an actual SITE photo (text-heavy info → false). */
  useOnSite: boolean;
  /** 0–10 photographic quality as a SITE photo (sharpness, framing, light).
   *  Drives the ranking that decides which photos survive the MAX_PHOTOS cut
   *  and which one becomes the hero (wave A). */
  siteQuality: number;
  /** The main subject reads clearly and isn't cropped at the edges. */
  subjectCentered: boolean;
  /** Text/stickers/collage/meme captions BURNED INTO the pixels — distinct from
   *  `textHeavy`, which is an OCR-sense verdict about the image's purpose. */
  burnedText: boolean;
  /** Survives a full-width hero banner (wide, sharp, room around the subject). */
  heroCandidate: boolean;
  /** Technical warnings from the classical sharp layer (may be empty). */
  warnings: string[];
  /** Deterministic §3-S0 palette of the STORED bytes (already corrected — this
   *  pass refetches what the bucket serves), piggybacking on that fetch for the
   *  backfill path. CODE-derived, never a vision answer: the model is asked no
   *  color questions, keeping the color axis deterministic. */
  palette?: string[];
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
    // Downscale before base64: the API bills vision by image size, and neither
    // classification nor OCR needs an 8MB original. Sharp is native → lazy +
    // fail-open to the original bytes (same contract as qualityPass).
    let sendBuf = buf;
    let sendMime: SupportedMime = mime as SupportedMime;
    try {
      const sharp = (await import("sharp")).default;
      sendBuf = await sharp(buf).resize(1024, 1024, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
      sendMime = "image/jpeg";
    } catch {
      /* keep originals */
    }
    return { buf, b64: sendBuf.toString("base64"), mime: sendMime };
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
          "Чи придатне фото для сайту цього бізнесу взагалі. false лише за РЕАЛЬНОЇ проблеми: сильно розмите/темне, нечитабельне, явно чужий або випадковий контент. Сумніваєшся — true.",
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
      ocrText: {
        type: "string",
        description:
          "ВЕСЬ видимий на зображенні текст, переписаний ДОСЛІВНО мовою оригіналу (написи, цінники, підписи, вивіски, номери). Порядок — як на зображенні. Якщо тексту немає — порожній рядок. Нічого не додавай і не перекладай.",
      },
      textHeavy: {
        type: "boolean",
        description:
          "true, якщо зображення переважно про ТЕКСТ (прайс, скріншот, афіша, картинка з великими написами) — таке радше джерело інформації, ніж фото для галереї. false для звичайних предметних/інтерʼєрних фото.",
      },
      useOnSite: {
        type: "boolean",
        description:
          "Чи варто ставити це саме зображення як ФОТО на сайт (герой/галерея). false для textHeavy-картинок, скріншотів, прайсів — вони цінні як джерело даних, але не як фото. true для якісних предметних/інтерʼєрних/командних фото.",
      },
      siteQuality: {
        type: "integer",
        minimum: 0,
        maximum: 10,
        description:
          "Від 0 до 10: наскільки фото годиться на сайт бізнесу — різкість, композиція, світло. 0–3 — розмите, темне, шумне або зняте «як вийде»; 4–6 — звичайне робоче фото з телефона; 7–10 — чітке, добре освітлене, з чистим кадром. Оцінюй ЯКІСТЬ знімка, а не привабливість самого товару чи місця.",
      },
      subjectCentered: {
        type: "boolean",
        description:
          "true, якщо головний обʼєкт (товар, страва, майстер, приміщення) добре читається і не обрізаний по краях. false, якщо обʼєкт скраю, наполовину за кадром або губиться серед іншого.",
      },
      burnedText: {
        type: "boolean",
        description:
          "true, якщо НА зображення накладено текст, стікери, рамки, емодзі, колаж чи мем-підписи — вигоріле в пікселі, прибрати неможливо. false для природного тексту самої сцени: вивіска, етикетка, меню на стіні, напис на упаковці.",
      },
      heroCandidate: {
        type: "boolean",
        description:
          "true, якщо фото витримає великий головний банер на всю ширину екрана: горизонтальне або квадратне, різке, з вільним простором навколо обʼєкта і без накладеного тексту. Сумніваєшся — false.",
      },
      extractedInfo: {
        type: "object",
        description:
          "Реквізити, ЯВНО написані на зображенні (з ocrText). Заповнюй лише те, що прямо видно; порожні поля лишай порожніми. Нічого не вигадуй.",
        properties: {
          phones: { type: "array", items: { type: "string" }, description: "Номери телефонів, як написані." },
          prices: {
            type: "array",
            description: "Позиції з цінами, якщо на зображенні є прайс.",
            items: {
              type: "object",
              properties: {
                name: { type: "string", description: "Назва позиції, як у тексті." },
                price: { type: "string", description: "Ціна дослівно (напр. «350 грн»)." },
              },
              required: ["name", "price"],
            },
          },
          addresses: { type: "array", items: { type: "string" }, description: "Адреси, як написані." },
          hours: { type: "string", description: "Графік роботи, якщо написаний." },
          promos: { type: "array", items: { type: "string" }, description: "Акції/знижки, дослівно." },
        },
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
    required: ["kind", "suitable", "reason", "ocrText", "textHeavy", "useOnSite", "siteQuality"],
  },
};

/** Model score → an integer inside 0…10; anything else → the neutral default. */
function clampQuality(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return DEFAULT_SITE_QUALITY;
  return Math.min(10, Math.max(0, Math.round(v)));
}

/** Trimmed non-empty string capped at `max`, else undefined. */
function clean(s: unknown, max: number): string | undefined {
  return typeof s === "string" && s.trim() ? stripLoneSurrogates(safeSlice(s.trim(), max)) : undefined;
}

/** Coerce an unknown value to a bounded array of trimmed non-empty strings. */
function strArray(v: unknown, maxItems = 10, maxLen = 200): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => clean(x, maxLen))
    .filter((x): x is string => Boolean(x))
    .slice(0, maxItems);
}

/** Coerce an unknown value to a bounded array of {name, price} pairs. */
function priceArray(v: unknown): { name: string; price: string }[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => {
      const rec = x && typeof x === "object" ? (x as Record<string, unknown>) : {};
      const name = clean(rec.name, 120);
      const price = clean(rec.price, 60);
      return name && price ? { name, price } : null;
    })
    .filter((x): x is { name: string; price: string } => x !== null)
    .slice(0, 40);
}

/** Normalize the model's optional extractedInfo into the always-present shape. */
function normalizeExtractedInfo(v: unknown): ExtractedInfo {
  const rec = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  const hours = clean(rec.hours, 200);
  return {
    phones: strArray(rec.phones, 8, 60),
    prices: priceArray(rec.prices),
    addresses: strArray(rec.addresses, 6, 200),
    ...(hours && { hours }),
    promos: strArray(rec.promos, 8, 200),
  };
}

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
  // Deterministic palette rides the same byte fetch, in parallel with the
  // vision call. Fail-open null; the model never sees or produces hexes.
  const paletteP = extractPalette(img.buf);

  try {
    const client = getAnthropic();
    const res = await client.messages.create(
      {
        model: VISION_MODEL,
        max_tokens: 1200,
        // Bounded classification/OCR task: no thinking, minimal effort (§0.1).
        // Sonnet 5 runs adaptive thinking by default when omitted, so disable
        // it explicitly (accepted on Sonnet 5; only Fable 5 rejects "disabled").
        thinking: { type: "disabled" },
        output_config: { effort: "low" },
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: img.mime, data: img.b64 } },
              {
                type: "text",
                text: "Власник малого бізнесу завантажив це фото для свого сайту. Класифікуй його, перепиши ВЕСЬ видимий текст дослівно (ocrText), познач, чи це радше інформаційна картинка з текстом (textHeavy) чи справжнє фото для сайту (useOnSite), оціни якість знімка (siteQuality, subjectCentered, burnedText, heroCandidate) і витягни телефони/ціни/адреси/години/акції, якщо вони написані на зображенні. Оцінюй суворо: з цих оцінок ми обираємо, які фото взагалі потраплять на сайт і яке стане головним банером. Пиши лише те, що бачиш — нічого не вигадуй. Виклич photo_analysis.",
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
    const input = tool.input as Record<string, unknown>;
    const kind = input.kind;
    if (typeof kind !== "string" || !PHOTO_KINDS.includes(kind as PhotoKind)) return null;
    if (typeof input.suitable !== "boolean") return null;

    const textHeavy = input.textHeavy === true;
    const isReview = kind === "review";
    const palette = await paletteP;
    return {
      ...(palette?.length && { palette }),
      kind: kind as PhotoKind,
      suitable: input.suitable,
      reason: clean(input.reason, 200) ?? "",
      alt: clean(input.alt, 200),
      // Review fields only make sense for review screenshots — a stray quote
      // on another kind must never become a testimonial candidate.
      ...(isReview && { reviewQuote: clean(input.reviewQuote, 600) }),
      ...(isReview && { reviewAuthor: clean(input.reviewAuthor, 80) }),
      ocrText: clean(input.ocrText, 4000) ?? "",
      textHeavy,
      extractedInfo: normalizeExtractedInfo(input.extractedInfo),
      // Trust the model's verdict; fall back to a sane default if it omitted it.
      useOnSite:
        typeof input.useOnSite === "boolean" ? input.useOnSite : input.suitable && !textHeavy,
      // A missing/garbled score becomes the neutral default, so an unrated photo
      // ranks with the ordinary ones instead of being buried (see lib/media/rank).
      siteQuality: clampQuality(input.siteQuality),
      subjectCentered: input.subjectCentered === true,
      burnedText: input.burnedText === true,
      heroCandidate: input.heroCandidate === true,
      warnings: await warningsP,
    };
  } catch (e) {
    console.warn(`[analyze-photo] vision failed: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}
