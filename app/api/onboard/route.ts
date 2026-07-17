import { headers } from "next/headers";
import { getAnthropic, CHAT_MODEL } from "@/lib/ai/anthropic";
import {
  prepareOnboardCall,
  parseOnboardMessage,
  computeProgress,
  fallbackQuestion,
  saveFactsTool,
  type ChatMsg,
} from "@/lib/ai/onboard";
import { checkRateLimit, ipFromHeaders, rateLimitMessage } from "@/lib/rate-limit";
import { businessFactsSchema, type BusinessFacts } from "@/lib/verticals/schema";
import { getTemplate, templateDisplayName } from "@/lib/templates/registry";
import { mediaSchema, type SiteMedia } from "@/lib/media/media";

/**
 * Streaming onboarding turn (P4). Same stateless contract as onboardAction —
 * the client sends full history + facts — but the reply streams as SSE and the
 * model runs with extended thinking (deeper advisor questions; the owner
 * accepted the latency for data quality).
 *
 * Events: {t:"think"} thinking started · {t:"d",text} text delta ·
 * {t:"final",…ParsedOnboardMessage,progress} structured turn result ·
 * {t:"error",message}. Refusals (rate limit / over-long chat) come back as
 * plain JSON, not a stream — the client falls back to a normal bubble.
 */

export const maxDuration = 120;

function maxChatMessages(): number {
  const n = Number.parseInt(process.env.RATE_LIMIT_CHAT_MAX_MESSAGES ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : 120;
}

const MAX_MSG_CHARS = 4000;
const MAX_BODY_BYTES = 128 * 1024;

function parseBody(body: unknown): {
  history: ChatMsg[];
  facts: Partial<BusinessFacts>;
  verticalId?: string;
  templateId?: string;
  media?: SiteMedia;
} | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (!Array.isArray(b.messages) || b.messages.length > maxChatMessages() + 1) return null;
  const history: ChatMsg[] = [];
  for (const m of b.messages) {
    if (!m || typeof m !== "object") return null;
    const { role, content } = m as Record<string, unknown>;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") return null;
    history.push({ role, content: content.slice(0, MAX_MSG_CHARS) });
  }
  // Facts feed the system prompt — accept ONLY what the real schema accepts.
  // Malformed shapes (e.g. non-array services) must 400 here, never throw
  // deeper in validateFacts.
  const factsParsed = businessFactsSchema.partial().safeParse(b.facts ?? {});
  if (!factsParsed.success) return null;
  const verticalId = typeof b.verticalId === "string" ? b.verticalId.slice(0, 40) : undefined;
  // B2: the previously chosen design threads through the stateless turn.
  // Unknown ids collapse to undefined (free pick) instead of rejecting the turn.
  const templateId =
    typeof b.templateId === "string" && getTemplate(b.templateId) ? b.templateId : undefined;
  // G4: uploaded media feeds the prompt's photo inventory. It only informs the
  // system prompt, so malformed media collapses to undefined (turn proceeds)
  // rather than rejecting the request.
  const mediaParsed = mediaSchema.safeParse(b.media);
  const media = b.media != null && mediaParsed.success ? (mediaParsed.data as SiteMedia) : undefined;
  return { history, facts: factsParsed.data, verticalId, templateId, media };
}

export async function POST(req: Request): Promise<Response> {
  // Order matters (adversarial review): rate limit and size caps run BEFORE
  // the body is parsed — an abuser costs neither CPU on JSON.parse nor tokens.
  const limit = await checkRateLimit("chat_turn", ipFromHeaders(await headers()));
  if (!limit.ok) return Response.json({ t: "refusal", message: rateLimitMessage(limit.retryAfterSec) });

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
  const parsed = parseBody(json);
  if (!parsed) return Response.json({ t: "refusal", message: "Некоректний запит." }, { status: 400 });
  const { history, facts, verticalId, templateId, media } = parsed;

  if (history.length > maxChatMessages()) {
    return Response.json({
      t: "refusal",
      message: "Ця розмова вже дуже довга. Натисніть «Все вірно, генеруємо» — або почніть нову розмову.",
    });
  }

  const call = prepareOnboardCall(history, facts, verticalId, templateId, media);
  if (!call) {
    return Response.json({
      t: "refusal",
      message: "Розкажіть трохи про ваш бізнес — що це за справа, у якому місті, і який телефон?",
    });
  }

  const client = getAnthropic();
  // Thinking + tools require tool_choice auto (see generate.ts note) — save_facts
  // is auto here anyway. max_tokens covers thinking budget + the visible reply.
  const stream = client.messages.stream({
    model: CHAT_MODEL,
    max_tokens: 6000,
    thinking: { type: "enabled", budget_tokens: 2000 },
    system: call.system,
    tools: [saveFactsTool],
    messages: call.messages,
  });

  const enc = new TextEncoder();
  const rs = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));
      try {
        for await (const ev of stream) {
          if (ev.type === "content_block_start" && ev.content_block.type === "thinking") {
            send({ t: "think" });
          } else if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
            send({ t: "d", text: ev.delta.text });
          }
        }
        const final = await stream.finalMessage();
        let out = parseOnboardMessage(final, facts, verticalId ?? call.vertical.id, templateId);
        // Collecting-turn invariant (adversarial review): a turn without a
        // question stalls the funnel. Streaming can't retry invisibly, so we
        // append a deterministic follow-up derived from the missing facts.
        if (!out.ready && !out.message.includes("?")) {
          out = { ...out, message: `${out.message}\n\n${fallbackQuestion(out.facts)}` };
        }
        send({
          t: "final",
          ...out,
          templateLabel: templateDisplayName(out.templateId),
          progress: computeProgress(out.facts),
        });
      } catch {
        send({ t: "error", message: "Щось пішло не так. Спробуйте ще раз." });
      } finally {
        controller.close();
      }
    },
    cancel() {
      stream.abort();
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
