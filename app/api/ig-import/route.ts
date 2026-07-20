import { headers } from "next/headers";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { checkRateLimit, ipFromHeaders, rateLimitMessage } from "@/lib/rate-limit";
import { fetchInstagramProfile, isApifyConfigured } from "@/lib/ig/apify";
import { extractFactsFromProfile, type IgExtractedFacts } from "@/lib/ig/extract";
import { importExternalImage } from "@/lib/media/import";
import { analyzePhoto, type PhotoAnalysis } from "@/lib/media/analyze-photo";
import { normalizeIgHandle } from "@/lib/blocks/contact-links";

/**
 * Instagram-first onboarding import (wave E, SSE like /api/onboard): scrape
 * the profile the OWNER gave us (explicit consent = pasting their link), pull
 * bio + latest posts, import every image into our Storage (§4.8), run the
 * wave-G vision pass per photo and one facts-extraction pass over the text.
 *
 * The whole pipeline runs 1–2 minutes — far past the server-action ceiling —
 * so it lives in a route with an extended budget and streams progress stages
 * the spinner card renders verbatim.
 *
 * Events: {t:"stage",stage:"profile"|"posts"} · {t:"photos",done,total} ·
 * {t:"hb"} heartbeat (proxies must not idle-close the long Apify wait) ·
 * {t:"final",handle,items,extracted?,bio?} · {t:"error",message}.
 * Refusals (no token / rate limit / bad input) are plain JSON, not a stream.
 *
 * FAIL-OPEN: any hard failure ends in a soft Ukrainian message and the chat
 * continues the classic way. Facts stay CANDIDATES — the client shows them for
 * explicit confirmation (invariant №5); nothing here touches the DB except
 * image files landing in the bucket.
 */

export const maxDuration = 300;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEARTBEAT_MS = 10_000;

/** Same shape the chat-upload flow feeds routeBatch (OnboardChat BatchItem). */
type ImportItem =
  | { failed: true }
  | {
      failed: false;
      url: string;
      analysis: { ok: true; analysis: PhotoAnalysis } | { ok: false };
      warnings: string[];
    };

export async function POST(req: Request): Promise<Response> {
  if (!isApifyConfigured() || !isSupabaseConfigured()) {
    return Response.json(
      { t: "refusal", message: "Імпорт з Instagram зараз недоступний." },
      { status: 503 },
    );
  }

  // Scraping burns real Apify credit — limit before doing anything else.
  const limit = await checkRateLimit("ig_import", ipFromHeaders(await headers()));
  if (!limit.ok) {
    return Response.json({ t: "refusal", message: rateLimitMessage(limit.retryAfterSec) });
  }

  const body = (await req.json().catch(() => null)) as
    | { conversationId?: unknown; handle?: unknown }
    | null;
  const conversationId =
    typeof body?.conversationId === "string" && UUID_RE.test(body.conversationId)
      ? body.conversationId
      : null;
  const handle = normalizeIgHandle(typeof body?.handle === "string" ? body.handle : null);
  if (!conversationId || !handle) {
    return Response.json({ t: "refusal", message: "Некоректний запит." }, { status: 400 });
  }

  // The conversation must exist BEFORE we spend Apify credit; images scope to
  // its tenant (same resolution the upload route uses).
  const sb = getServiceClient();
  const { data: conv } = await sb
    .from("conversations")
    .select("tenant_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conv?.tenant_id) {
    return Response.json({ t: "refusal", message: "Некоректний запит." }, { status: 400 });
  }

  const enc = new TextEncoder();
  const rs = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));
      const heartbeat = setInterval(() => {
        try {
          send({ t: "hb" });
        } catch {
          /* stream already closed */
        }
      }, HEARTBEAT_MS);

      try {
        send({ t: "stage", stage: "profile" });
        const profile = await fetchInstagramProfile(handle, {
          onPhase: (phase) => {
            if (phase === "fetching") send({ t: "stage", stage: "posts" });
          },
        });
        if (!profile) {
          send({
            t: "error",
            message:
              "Не вдалося зазирнути у профіль — можливо, він приватний або Instagram не відповідає. Нічого страшного: розкажіть про бізнес самі.",
          });
          return;
        }

        // Avatar first (often the logo), then post images in feed order. Every
        // image goes through our Storage (§4.8) + the wave-G vision verdict;
        // the CLIENT routes them with the same brain as chat uploads.
        const sources = [
          ...(profile.avatarUrl ? [profile.avatarUrl] : []),
          ...profile.posts.map((p) => p.imageUrl),
        ];
        let done = 0;
        send({ t: "photos", done, total: sources.length });
        const items = await Promise.all(
          sources.map(async (src): Promise<ImportItem> => {
            try {
              const url = await importExternalImage(src, { conversationId });
              if (!url) return { failed: true };
              // Direct lib call (not the server action): the ig_import limit
              // already gates this batch; a second per-photo gate would let one
              // import exhaust img_analyze for the owner's own chat uploads.
              const analysis = await analyzePhoto(url);
              return {
                failed: false,
                url,
                analysis: analysis ? { ok: true, analysis } : { ok: false },
                warnings: [],
              };
            } catch {
              return { failed: true };
            } finally {
              done += 1;
              send({ t: "photos", done, total: sources.length });
            }
          }),
        );

        // One text pass over bio+captions → candidate facts (fail-open null).
        const extracted: IgExtractedFacts | null = await extractFactsFromProfile(profile);

        send({
          t: "final",
          handle: profile.handle,
          ...(profile.bio && { bio: profile.bio }),
          items,
          ...(extracted && { extracted }),
        });
      } catch (e) {
        console.warn(`[ig-import] failed: ${e instanceof Error ? e.message : String(e)}`);
        send({
          t: "error",
          message:
            "Щось пішло не так з імпортом. Нічого страшного: розкажіть про бізнес самі.",
        });
      } finally {
        clearInterval(heartbeat);
        controller.close();
      }
    },
  });

  return new Response(rs, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
