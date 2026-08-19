import "server-only";
import OpenAI from "openai";
import type {
  Response as OaiResponse,
  ResponseInput,
  ResponseInputItem,
  ResponseCreateParamsNonStreaming,
  Tool as OaiTool,
} from "openai/resources/responses/responses";

/**
 * The ONE model seam — an Anthropic-shaped adapter over the OpenAI Responses
 * API (owner decision 2026-08-19: «Change AI model for everything to openai
 * gpt 5.6 luna», with raised reasoning). Every call site keeps the block
 * vocabulary the codebase was written in (`content: [{type:"text"|"tool_use"}]`,
 * `stop_reason`, tool_result round-trips) and only this file speaks OpenAI:
 * porting ten files to a second vocabulary is how migrations rot halfway.
 *
 * Mapping notes (each is a real difference, not trivia):
 * - system → `instructions`; Anthropic cache_control breakpoints DROP — OpenAI
 *   prompt caching is automatic on stable prefixes (≥1024 tokens), no markup.
 * - thinking/output_config.effort → `reasoning.effort`. gpt-5.6 supports
 *   none|low|medium|high|xhigh|max; «disabled» maps to "none".
 * - tool_use ↔ `function_call` items (call_id, JSON-string arguments);
 *   tool_result ↔ `function_call_output`. IDs pass through verbatim.
 * - Anthropic's SERVER web_fetch tool has no equivalent — the onboard route
 *   now executes web_fetch itself (see lib/ai/web-fetch.ts) as a normal
 *   round-trip tool; `pause_turn` therefore no longer exists.
 * - task_budget has no equivalent; the agentic loops were already bounded by
 *   MAX_ROUNDS and stage budgets, which stay authoritative.
 */

// Single tier for every call (same policy the Anthropic setup had): the owner
// picks the model once, per-call quality is steered with reasoning effort.
// Env override for experiments without a deploy.
const LUNA = process.env.OPENAI_MODEL ?? "gpt-5.6-luna";
export const GEN_MODEL = LUNA; // site generation (S1/S2/S4)
export const CHAT_MODEL = LUNA; // onboarding + editor agent
export const VISION_MODEL = LUNA; // photo intelligence

export type LlmEffort = "none" | "low" | "medium" | "high" | "xhigh" | "max";

export interface LlmTextBlock {
  type: "text";
  text: string;
}
export interface LlmToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: unknown;
}
export type LlmBlock = LlmTextBlock | LlmToolUseBlock;

export interface LlmToolResultBlock {
  type: "tool_result";
  tool_use_id: string;
  content: string;
}
export interface LlmImageBlock {
  type: "image";
  source: { type: "base64"; media_type: string; data: string } | { type: "url"; url: string };
}
export type LlmInBlock = LlmTextBlock | LlmToolUseBlock | LlmToolResultBlock | LlmImageBlock;

export interface LlmMessage {
  role: "user" | "assistant";
  content: string | LlmInBlock[];
}

export interface LlmTool {
  name: string;
  description?: string;
  input_schema: unknown;
}

export type LlmToolChoice = { type: "auto" } | { type: "tool"; name: string } | { type: "none" };

export interface LlmUsage {
  input_tokens: number;
  output_tokens: number;
  /** OpenAI reports cached prefix reads; writes have no separate meter. */
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
}

export interface LlmFinal {
  content: LlmBlock[];
  stop_reason: "end_turn" | "tool_use" | "max_tokens";
  usage: LlmUsage;
}

export interface LlmCreateParams {
  model: string;
  max_tokens: number;
  system?: string;
  messages: LlmMessage[];
  tools?: LlmTool[];
  tool_choice?: LlmToolChoice;
  effort?: LlmEffort;
  /** text.verbosity (gpt-5.6: low|medium|high, default medium). The chat
   *  routes set "low" — replies are contracted to 1–3 sentences and 5.6 is
   *  already concise; generation paths keep the default. */
  verbosity?: "low" | "medium" | "high";
  signal?: AbortSignal;
}

let cached: OpenAI | null = null;

export function isLlmConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function getLlm(): OpenAI {
  if (cached) return cached;
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not set in .env.local");
  }
  // Same discipline as the Anthropic client: one attempt is bounded well under
  // the serverless budget; chains carry their own AbortSignal deadlines.
  cached = new OpenAI({ timeout: 120_000, maxRetries: 1 });
  return cached;
}

// ── request mapping ─────────────────────────────────────────────────────────

function toInput(messages: LlmMessage[]): ResponseInput {
  const items: ResponseInputItem[] = [];
  for (const m of messages) {
    if (typeof m.content === "string") {
      items.push({ role: m.role, content: m.content });
      continue;
    }
    // Split block content into (a) plain message parts and (b) top-level
    // function-call/-output items, preserving order between the groups per
    // message (the loops only ever append tool blocks after text).
    const parts: Array<
      | { type: "input_text"; text: string }
      | { type: "input_image"; image_url: string; detail: "auto" }
    > = [];
    for (const b of m.content) {
      if (b.type === "text") {
        if (m.role === "assistant") {
          items.push({ role: "assistant", content: b.text });
        } else {
          parts.push({ type: "input_text", text: b.text });
        }
      } else if (b.type === "image") {
        const url =
          b.source.type === "url"
            ? b.source.url
            : `data:${b.source.media_type};base64,${b.source.data}`;
        parts.push({ type: "input_image", image_url: url, detail: "auto" });
      } else if (b.type === "tool_use") {
        items.push({
          type: "function_call",
          call_id: b.id,
          name: b.name,
          arguments: JSON.stringify(b.input ?? {}),
        });
      } else if (b.type === "tool_result") {
        items.push({
          type: "function_call_output",
          call_id: b.tool_use_id,
          output: b.content,
        });
      }
    }
    if (parts.length) items.push({ role: "user", content: parts });
  }
  return items;
}

function toTools(tools?: LlmTool[]): OaiTool[] | undefined {
  if (!tools?.length) return undefined;
  return tools.map((t) => ({
    type: "function" as const,
    name: t.name,
    description: t.description,
    parameters: (t.input_schema ?? { type: "object" }) as Record<string, unknown>,
    // Our schemas are optional-heavy zod exports; strict mode demands
    // every-property-required and was already rejected for build_site on
    // Anthropic. Non-strict + one deterministic repair pass stays the policy.
    strict: false,
  }));
}

function toToolChoice(
  c?: LlmToolChoice,
): ResponseCreateParamsNonStreaming["tool_choice"] | undefined {
  if (!c) return undefined;
  if (c.type === "auto") return "auto";
  if (c.type === "none") return "none";
  return { type: "function", name: c.name };
}

function fromResponse(res: OaiResponse): LlmFinal {
  const content: LlmBlock[] = [];
  for (const item of res.output ?? []) {
    if (item.type === "message") {
      for (const part of item.content ?? []) {
        if (part.type === "output_text" && part.text) {
          content.push({ type: "text", text: part.text });
        }
      }
    } else if (item.type === "function_call") {
      let input: unknown = {};
      try {
        input = JSON.parse(item.arguments || "{}");
      } catch {
        input = {};
      }
      content.push({ type: "tool_use", id: item.call_id, name: item.name, input });
    }
  }
  const hitCap =
    res.status === "incomplete" && res.incomplete_details?.reason === "max_output_tokens";
  const stop_reason: LlmFinal["stop_reason"] = hitCap
    ? "max_tokens"
    : content.some((b) => b.type === "tool_use")
      ? "tool_use"
      : "end_turn";
  const u = res.usage;
  return {
    content,
    stop_reason,
    usage: {
      input_tokens: u?.input_tokens ?? 0,
      output_tokens: u?.output_tokens ?? 0,
      cache_read_input_tokens: u?.input_tokens_details?.cached_tokens ?? 0,
      cache_creation_input_tokens: 0,
    },
  };
}

function buildParams(params: LlmCreateParams): ResponseCreateParamsNonStreaming {
  return {
    model: params.model,
    max_output_tokens: params.max_tokens,
    ...(params.system && { instructions: params.system }),
    input: toInput(params.messages),
    ...(params.tools?.length && { tools: toTools(params.tools) }),
    ...(params.tool_choice && { tool_choice: toToolChoice(params.tool_choice) }),
    ...(params.effort && params.effort !== "none"
      ? { reasoning: { effort: params.effort } }
      : {}),
    ...(params.verbosity && { text: { verbosity: params.verbosity } }),
    // The agentic loops replay full history themselves — server-side state
    // would double-bill and drift from the transcript contract.
    store: false,
  };
}

/** One-shot request → Anthropic-shaped final. */
export async function llmCreate(params: LlmCreateParams): Promise<LlmFinal> {
  const res = await getLlm().responses.create(buildParams(params), {
    ...(params.signal && { signal: params.signal }),
  });
  return fromResponse(res);
}

// ── streaming ───────────────────────────────────────────────────────────────

/** The event subset our SSE routes actually consume. */
export type LlmStreamEvent =
  | { type: "thinking_start" }
  | { type: "tool_start"; name: string }
  | { type: "text_delta"; text: string };

export interface LlmStream {
  events: AsyncGenerator<LlmStreamEvent>;
  finalMessage(): Promise<LlmFinal>;
}

/** Streaming request — yields deltas, then the same final shape as create. */
export function llmStream(params: LlmCreateParams): LlmStream {
  const stream = getLlm().responses.stream(
    { ...buildParams(params), stream: true },
    { ...(params.signal && { signal: params.signal }) },
  );

  async function* events(): AsyncGenerator<LlmStreamEvent> {
    for await (const ev of stream) {
      if (ev.type === "response.output_item.added") {
        if (ev.item.type === "reasoning") yield { type: "thinking_start" };
        else if (ev.item.type === "function_call")
          yield { type: "tool_start", name: ev.item.name };
      } else if (ev.type === "response.output_text.delta") {
        yield { type: "text_delta", text: ev.delta };
      }
    }
  }

  return {
    events: events(),
    finalMessage: async () => fromResponse(await stream.finalResponse()),
  };
}
