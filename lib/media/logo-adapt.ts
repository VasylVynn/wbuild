import "server-only";
import { getServiceClient } from "@/lib/supabase/server";
import { getAnthropic, isAnthropicConfigured, GEN_MODEL } from "@/lib/ai/anthropic";
import { isStorageUrl } from "./media";

/**
 * Logo adaptation pipeline (H1): when the owner's logo visually fights the
 * chosen template's nav surface (classic case — a white-box logo on a dark
 * nav), produce an ADAPTED variant: background removed / colors nudged for
 * contrast, nothing redrawn. The original upload is never touched; the adapted
 * file lands in our bucket next to other generated assets and the caller
 * stores it as brand.logoAdaptedUrl.
 *
 * FAIL-OPEN like generateHeroImage: missing keys, timeouts, API errors, an
 * unsupported format — all resolve to `null` (= keep showing the original).
 * The vision gate errs toward "fits": we only generate when the clash is real,
 * because every generation costs money and risks drift (journal #46 — risk
 * accepted by the owner, with the editor's «Оригінал/Адаптоване» toggle as
 * the review tool).
 */

const GEMINI_MODEL = "gemini-2.5-flash-image";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const BUCKET = "photos";
const FETCH_TIMEOUT_MS = 10_000;
const VISION_TIMEOUT_MS = 15_000;
const GEMINI_TIMEOUT_MS = 25_000;
const MAX_LOGO_BYTES = 8 * 1024 * 1024;

type SupportedMime = "image/jpeg" | "image/png" | "image/gif" | "image/webp";
const SUPPORTED_MIMES: SupportedMime[] = ["image/jpeg", "image/png", "image/gif", "image/webp"];

/**
 * What the logo sits ON, per template — short English surface descriptions for
 * the vision judge and the adaptation prompt. Presentation metadata for an
 * internal prompt, deliberately colocated here rather than in the template
 * registry. Unknown template → generic wording.
 */
const NAV_SURFACES: Record<string, string> = {
  studio: "a near-black dark navigation bar with white text and violet accents",
  ferri: "a deep navy dark navigation bar with cream serif text and gold accents",
  salon: "a light cream navigation bar with dark text and rose-gold accents",
  portfolio: "a dark charcoal navigation bar with white text",
  aisaas: "a white light navigation bar with dark text and indigo accents",
  nextly: "a white light navigation bar with dark text and blue accents",
  react2021: "a white light navigation bar with dark text",
  restaurant: "a warm cream navigation bar with dark brown text and terracotta accents",
};

function navSurface(templateId: string): string {
  return NAV_SURFACES[templateId] ?? "a website navigation bar";
}

async function fetchLogoBytes(
  url: string,
): Promise<{ b64: string; mime: SupportedMime } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const mime = (res.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!SUPPORTED_MIMES.includes(mime as SupportedMime)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > MAX_LOGO_BYTES) return null;
    return { b64: buf.toString("base64"), mime: mime as SupportedMime };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Vision gate: does the original logo already sit well on this surface? */
async function logoFitsSurface(
  b64: string,
  mime: SupportedMime,
  surface: string,
): Promise<{ fits: boolean; issues: string } | null> {
  try {
    const client = getAnthropic();
    const res = await client.messages.create(
      {
        model: GEN_MODEL,
        max_tokens: 300,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mime, data: b64 } },
              {
                type: "text",
                text: `This logo will be displayed at ~32px height on ${surface}. Judge ONLY whether it visually works there: an opaque background box that clashes with the bar, unreadable low-contrast colors, or heavy solid padding are real problems. Minor imperfections are fine — when in doubt, answer fits=true. Call logo_verdict.`,
              },
            ],
          },
        ],
        tools: [
          {
            name: "logo_verdict",
            description: "Verdict on whether the logo works on the given surface as-is.",
            input_schema: {
              type: "object",
              properties: {
                fits: { type: "boolean" },
                issues: {
                  type: "string",
                  description:
                    "When fits=false: the concrete visual problems, in English, one short sentence.",
                },
              },
              required: ["fits"],
            },
          },
        ],
        tool_choice: { type: "tool", name: "logo_verdict" },
      },
      { timeout: VISION_TIMEOUT_MS },
    );
    const tool = res.content.find((c) => c.type === "tool_use");
    if (!tool || tool.type !== "tool_use") return null;
    const input = tool.input as { fits?: boolean; issues?: string };
    if (typeof input.fits !== "boolean") return null;
    return { fits: input.fits, issues: input.issues ?? "" };
  } catch (e) {
    console.warn(`[logo-adapt] vision gate failed: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

/** nano-banana adaptation: same logo, surface-compatible presentation. */
async function generateAdaptedLogo(
  b64: string,
  mime: SupportedMime,
  surface: string,
  issues: string,
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const prompt =
    `Adapt this exact logo for display on ${surface}. ` +
    (issues ? `Known problems to fix: ${issues}. ` : "") +
    `Remove any opaque background box (make the background fully transparent) and, only if needed for readability, adjust the colors of existing elements for contrast with the bar. ` +
    `CRITICAL: adapt, do NOT redraw — preserve the exact shapes, lettering, proportions and composition of the original. No new elements, no text changes, no style changes. ` +
    `Output a PNG with a transparent background.`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  try {
    const res = await fetch(GEMINI_ENDPOINT, {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "content-type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ inlineData: { mimeType: mime, data: b64 } }, { text: prompt }],
          },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[logo-adapt] gemini ${res.status}`);
      return null;
    }
    type GeminiPart = {
      inlineData?: { data?: string; mimeType?: string };
      inline_data?: { data?: string; mime_type?: string };
    };
    const json = (await res.json()) as {
      candidates?: { content?: { parts?: GeminiPart[] } }[];
    };
    const parts = json.candidates?.[0]?.content?.parts ?? [];
    const imgPart = parts.find((p) => p.inlineData?.data ?? p.inline_data?.data);
    const data = imgPart?.inlineData?.data ?? imgPart?.inline_data?.data;
    if (!data) return null;
    const outMime = imgPart?.inlineData?.mimeType ?? imgPart?.inline_data?.mime_type ?? "image/png";
    const ext = outMime.includes("webp") ? "webp" : outMime.includes("jpeg") ? "jpg" : "png";

    const sb = getServiceClient();
    const path = `generated/logo/${crypto.randomUUID()}.${ext}`;
    const { error } = await sb.storage
      .from(BUCKET)
      .upload(path, Buffer.from(data, "base64"), { contentType: outMime, upsert: false });
    if (error) {
      console.warn(`[logo-adapt] upload failed: ${error.message}`);
      return null;
    }
    return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  } catch (e) {
    console.warn(`[logo-adapt] ${e instanceof Error ? e.message : String(e)}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Full pipeline: vision gate → adapt → bucket URL. `null` means "keep the
 * original" — either it already fits, or something failed (fail-open).
 */
export async function adaptLogoForTemplate(opts: {
  logoUrl: string;
  templateId: string;
}): Promise<string | null> {
  if (!isStorageUrl(opts.logoUrl)) return null; // §4.8 — we only touch our own assets
  if (!isAnthropicConfigured() || !process.env.GEMINI_API_KEY) return null;

  const logo = await fetchLogoBytes(opts.logoUrl);
  if (!logo) return null;

  const surface = navSurface(opts.templateId);
  const verdict = await logoFitsSurface(logo.b64, logo.mime, surface);
  // Unknown verdict → don't spend a generation on a guess.
  if (!verdict || verdict.fits) return null;

  return generateAdaptedLogo(logo.b64, logo.mime, surface, verdict.issues);
}
