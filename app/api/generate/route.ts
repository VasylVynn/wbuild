import { getUser, isAuthConfigured } from "@/lib/supabase/auth";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { businessFactsSchema, type BusinessFacts } from "@/lib/verticals/schema";
import { sanitizeMedia, type SiteMedia } from "@/lib/media/media";
import type { PipelineStageEvent } from "@/lib/site/pipeline";
import { runGenerateFlow } from "@/lib/onboard/generate-flow";
import { createLogger } from "@/lib/log";

const log = createLogger("api-generate");

/**
 * Draft generation transport (pipeline v2, spec §7): an authed SSE POST that
 * streams the pipeline's stage boundaries while the generation runs, so the
 * chat shows real progress instead of a paced clock. The flow itself (gates,
 * host, pipeline, ownership, funnel) is lib/onboard/generate-flow.ts — shared
 * with the non-stream fallback `generateDraftAction`.
 *
 * SSE events (all JSON on `data:` lines; `:` heartbeat comments in between):
 *   {t:"stage", name, status, detail?}          — every pipeline stage boundary
 *                                                 (s0_grounding … s4_qa; status
 *                                                 start|done|skipped|error)
 *   {t:"s3_done", host, previewUrl, editUrl}    — the PREVIEW-READY point (TFAO):
 *                                                 the client transitions NOW; S4
 *                                                 keeps streaming after it
 *   {t:"done", host, previewUrl, editUrl}       — the flow finished (post-S4)
 *   {t:"error", message, authRequired?}         — the flow failed (refusal or
 *                                                 pipeline error)
 * Pre-stream refusals (bad body / no session) are plain JSON
 * {t:"refusal", message, authRequired?}, mirroring /api/onboard.
 *
 * Each stage boundary is also upserted into `generation_progress` (migration
 * 0011) — the M12 rehydration store and the polling fallback when SSE dies.
 */

export const maxDuration = 300;

const MAX_BODY_BYTES = 128 * 1024;
const HEARTBEAT_MS = 15_000;

// The M1 claim gate lives INSIDE runGenerateFlow (spec §7): both transports —
// this route and the fallback generateDraftAction — must pass the same gate,
// so a route-local check would be bypassable by design. Its refusal streams
// back as {t:"error"} like any other flow refusal.

interface GenerateBody {
  facts: Partial<BusinessFacts>;
  verticalId?: string;
  media?: SiteMedia;
  conversationId?: string;
}

function parseBody(body: unknown): GenerateBody | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const factsParsed = businessFactsSchema.partial().safeParse(b.facts ?? {});
  if (!factsParsed.success) return null;
  const verticalId = typeof b.verticalId === "string" ? b.verticalId.slice(0, 40) : undefined;
  // Untrusted media → sanitized PER ITEM (sanitizeMedia's own contract — the
  // flow sanitizes again, which is idempotent). No all-or-nothing safeParse
  // gate here: one invalid entry must drop that entry, not every photo and the
  // logo — the exact collapse sanitizeMedia was rewritten to prevent, and the
  // fallback action path is per-item tolerant already.
  const media = b.media != null ? sanitizeMedia(b.media) : undefined;
  const conversationId =
    typeof b.conversationId === "string" && b.conversationId.trim()
      ? b.conversationId.trim().slice(0, 64)
      : undefined;
  return {
    facts: factsParsed.data,
    ...(verticalId && { verticalId }),
    ...(media && { media }),
    ...(conversationId && { conversationId }),
  };
}

/**
 * Progress-store write, one row per host (0011). Fail-open like every stage
 * listener: a broken store must never take generation down — the SSE stream
 * (and, worst case, the fallback action) still deliver the result.
 */
async function writeProgress(host: string, event: PipelineStageEvent): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    const sb = getServiceClient();
    const { error } = await sb.from("generation_progress").upsert(
      {
        host,
        stage: event.stage,
        status: event.status,
        detail: event.detail ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "host" },
    );
    if (error) log.warn("generation_progress write failed", { host, error: error.message });
  } catch (e) {
    log.warn("generation_progress write threw", { host, error: e });
  }
}

export async function POST(req: Request): Promise<Response> {
  // Size cap BEFORE parsing (an abuser costs neither CPU nor tokens).
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) {
    return Response.json({ t: "refusal", message: "Запит завеликий." }, { status: 413 });
  }
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return Response.json({ t: "refusal", message: "Запит завеликий." }, { status: 413 });
  }
  let json: unknown = null;
  try {
    json = JSON.parse(raw);
  } catch {
    /* handled below */
  }
  const body = parseBody(json);
  if (!body) {
    return Response.json({ t: "refusal", message: "Некоректний запит." }, { status: 400 });
  }

  // Session pre-check (same auth util the action used) so an anonymous caller
  // gets a plain JSON refusal instead of a one-event stream. The flow re-checks
  // (it also serves the fallback action) — getUser is cheap and idempotent.
  if (isAuthConfigured()) {
    const user = await getUser();
    if (!user) {
      return Response.json(
        { t: "refusal", message: "Щоб створити сайт, спершу увійдіть.", authRequired: true },
        { status: 401 },
      );
    }
  }
  // The onboard_generate rate limit is checked INSIDE runGenerateFlow (one
  // counter increment per request, shared with the fallback action — checking
  // here too would double-charge the daily budget); its refusal streams back
  // as {t:"error"}.

  const enc = new TextEncoder();
  const rs = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const push = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(chunk));
        } catch {
          closed = true; // client went away — the pipeline keeps finishing.
        }
      };
      const send = (obj: unknown) => push(`data: ${JSON.stringify(obj)}\n\n`);
      // S2 can be silent for up to ~2 minutes — heartbeat comments keep the
      // connection alive through proxies. (`:`-lines are SSE comments; the
      // client's parser only reads `data:` lines.)
      const heartbeat = setInterval(() => push(": ping\n\n"), HEARTBEAT_MS);

      try {
        // Deliberately NOT passing req.signal: a client disconnect (tab close,
        // early navigation to /edit, a proxy cutting the SSE) must not abort
        // the model chain — the pipeline's own 240s deadline is the only clock,
        // so a disconnect still yields a persisted draft (pre-v2 behavior).
        const result = await runGenerateFlow({
          ...body,
          onStage: async (host, event) => {
            send({
              t: "stage",
              name: event.stage,
              status: event.status,
              ...(event.detail && { detail: event.detail }),
            });
            await writeProgress(host, event);
            if (event.stage === "s3_compile" && event.status === "done") {
              // The TFAO point (spec §3): the draft is written — the client
              // shows the preview NOW; s4 events keep streaming after it.
              send({
                t: "s3_done",
                host,
                previewUrl: `/edit/${host}/frame`,
                editUrl: `/edit/${host}`,
              });
            }
          },
        });
        if (result.ok) {
          send({ t: "done", host: result.host, previewUrl: result.previewUrl, editUrl: result.editUrl });
        } else {
          send({
            t: "error",
            message: result.error,
            ...(result.authRequired && { authRequired: true }),
          });
        }
      } catch (e) {
        log.error("generate stream failed", { error: e });
        send({ t: "error", message: "Не вдалося згенерувати сайт. Спробуйте ще раз." });
      } finally {
        clearInterval(heartbeat);
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed by the runtime */
        }
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
