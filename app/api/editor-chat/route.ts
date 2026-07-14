import { headers } from "next/headers";
import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, CHAT_MODEL } from "@/lib/ai/anthropic";
import {
  buildEditorSystem,
  buildTools,
  toolInputSchemas,
  type EditorChatMsg,
  type ToolName,
} from "@/lib/ai/editor-agent";
import { aiEditBlock } from "@/lib/ai/edit-block";
import {
  getEditorData,
  saveDraftBlocks,
  switchTheme,
} from "@/app/app/(protected)/edit/actions";
import { switchDesignPack } from "@/app/app/(protected)/edit/design-actions";
import { requireMember } from "@/lib/tenant/membership";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { checkRateLimit, ipFromHeaders, rateLimitMessage } from "@/lib/rate-limit";
import { blockLibrary } from "@/lib/blocks/library";
import { isBlockType, type StoredBlock } from "@/lib/blocks/schema";
import type { BusinessFacts } from "@/lib/verticals/schema";

/**
 * Agentic editor chat (P3): streaming turn of the multi-role assistant. The
 * model talks + calls tools; every tool lands in the DRAFT through the same
 * validated path as manual edits (saveDraftBlocks → validateBlocks → §4.8
 * image stripping). Loop: thinking + tool_choice auto (must-fix #3); strict
 * schema enforcement lives in the executors.
 *
 * SSE events: {t:"think"} · {t:"d",text} · {t:"tool",label} tool started ·
 * {t:"tooldone",summary,ok} · {t:"final",message,actions,blocksChanged,
 * blocks,theme} · {t:"error",message}. Refusals come back as plain JSON.
 *
 * Persistence (editor_chats, migration 0006) is best-effort: pre-migration the
 * chat still works, memory just doesn't survive a reload.
 */

export const maxDuration = 300;

const MAX_BODY_BYTES = 32 * 1024;
const MAX_LOOPS = 6;
const HISTORY_LIMIT = 40;

type ToolOutcome = { ok: boolean; summary: string };

export async function POST(req: Request): Promise<Response> {
  const limit = await checkRateLimit("editor_chat", ipFromHeaders(await headers()));
  if (!limit.ok) return Response.json({ t: "refusal", message: rateLimitMessage(limit.retryAfterSec) });

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return Response.json({ t: "refusal", message: "Запит завеликий." }, { status: 413 });
  }
  let body: { host?: unknown; message?: unknown } = {};
  try {
    body = JSON.parse(raw);
  } catch {
    /* handled below */
  }
  const host = typeof body.host === "string" ? body.host.slice(0, 200) : "";
  const userMessage = typeof body.message === "string" ? body.message.trim().slice(0, 4000) : "";
  if (!host || !userMessage) {
    return Response.json({ t: "refusal", message: "Некоректний запит." }, { status: 400 });
  }

  // Ownership gate — same rule as every editor action (§3.1).
  const gate = await requireMember({ host });
  if (!gate.ok) return Response.json({ t: "refusal", message: "Немає доступу." }, { status: 403 });

  const editorData = await getEditorData(host);
  if (!editorData) return Response.json({ t: "refusal", message: "Сайт не знайдено." }, { status: 404 });
  const site = editorData;

  const sb = isSupabaseConfigured() ? getServiceClient() : null;

  // Tenant facts + onboarding transcript (re-linked at finalize) + stats + chat memory.
  let facts: Partial<BusinessFacts> = {};
  let onboarding: EditorChatMsg[] | null = null;
  let stats: { views7: number; leads7: number } | null = null;
  let history: EditorChatMsg[] = [];
  if (sb) {
    const since7 = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const [tRes, convRes, chatRes, viewsRes, leadsRes] = await Promise.all([
      sb.from("tenants").select("facts").eq("id", site.tenantId).maybeSingle(),
      sb
        .from("conversations")
        .select("messages")
        .eq("tenant_id", site.tenantId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      sb.from("editor_chats").select("messages").eq("tenant_id", site.tenantId).maybeSingle(),
      sb
        .from("site_events")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", site.tenantId)
        .eq("kind", "view")
        .gte("created_at", since7),
      sb
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", site.tenantId)
        .gte("created_at", since7),
    ]);
    facts = (tRes.data?.facts as Partial<BusinessFacts>) ?? {};
    const convMsgs = convRes.data?.messages as EditorChatMsg[] | null;
    onboarding = Array.isArray(convMsgs) ? convMsgs : null;
    const chatMsgs = chatRes.data?.messages as EditorChatMsg[] | null;
    history = Array.isArray(chatMsgs) ? chatMsgs.slice(-HISTORY_LIMIT) : [];
    stats = { views7: viewsRes.count ?? 0, leads7: leadsRes.count ?? 0 };
  }

  // Working copy — tools mutate it and persist after each successful call.
  let blocks: StoredBlock[] = site.blocks;
  let theme = site.theme;
  let blocksChanged = false;
  const actions: string[] = [];

  const label = (i: number) =>
    `«${blockLibrary[blocks[i]?.type]?.label ?? blocks[i]?.type ?? "?"}»`;

  async function runTool(name: ToolName, input: unknown): Promise<ToolOutcome> {
    const parsed = toolInputSchemas[name].safeParse(input);
    if (!parsed.success) return { ok: false, summary: `Некоректні аргументи: ${parsed.error.message}` };
    const a = parsed.data as Record<string, unknown>;

    const persist = async (next: StoredBlock[], summary: string): Promise<ToolOutcome> => {
      const res = await saveDraftBlocks(host, next);
      if (!res.ok) return { ok: false, summary: `Не збереглося: ${res.error ?? "помилка валідації"}` };
      blocks = next;
      blocksChanged = true;
      actions.push(summary);
      return { ok: true, summary };
    };

    const inRange = (i: number) => i >= 0 && i < blocks.length;

    switch (name) {
      case "update_block": {
        const i = a.index as number;
        if (!inRange(i)) return { ok: false, summary: "Немає блоку з таким номером." };
        const next = blocks.map((b, j) => (j === i ? ({ ...b, props: a.props } as StoredBlock) : b));
        return persist(next, `Оновив вміст секції ${label(i)}`);
      }
      case "add_block": {
        if (!isBlockType(a.type as string))
          return { ok: false, summary: `Невідомий тип блоку "${a.type}". Доступні: ${Object.keys(blockLibrary).join(", ")}` };
        const pos = Math.min(Math.max(a.position as number, 0), blocks.length);
        const nb = { type: a.type, props: a.props, hidden: false } as unknown as StoredBlock;
        const next = [...blocks.slice(0, pos), nb, ...blocks.slice(pos)];
        return persist(next, `Додав секцію «${blockLibrary[nb.type]?.label ?? nb.type}»`);
      }
      case "remove_block": {
        const i = a.index as number;
        if (!inRange(i)) return { ok: false, summary: "Немає блоку з таким номером." };
        const what = label(i);
        return persist(blocks.filter((_, j) => j !== i), `Прибрав секцію ${what}`);
      }
      case "move_block": {
        const i = a.index as number;
        const to = Math.min(Math.max(a.to as number, 0), blocks.length - 1);
        if (!inRange(i)) return { ok: false, summary: "Немає блоку з таким номером." };
        const what = label(i);
        const next = blocks.slice();
        const [moved] = next.splice(i, 1);
        next.splice(to, 0, moved);
        return persist(next, `Переставив секцію ${what} на позицію ${to}`);
      }
      case "set_hidden": {
        const i = a.index as number;
        if (!inRange(i)) return { ok: false, summary: "Немає блоку з таким номером." };
        const next = blocks.map((b, j) => (j === i ? ({ ...b, hidden: a.hidden } as StoredBlock) : b));
        return persist(next, `${a.hidden ? "Приховав" : "Показав"} секцію ${label(i)}`);
      }
      case "set_skin": {
        const i = a.index as number;
        if (!inRange(i)) return { ok: false, summary: "Немає блоку з таким номером." };
        const next = blocks.map((b, j) => (j === i ? ({ ...b, skin: a.skin } as StoredBlock) : b));
        return persist(next, `Змінив вигляд секції ${label(i)}`);
      }
      case "regenerate_block": {
        const i = a.index as number;
        if (!inRange(i)) return { ok: false, summary: "Немає блоку з таким номером." };
        const res = await aiEditBlock({
          type: blocks[i].type,
          props: blocks[i].props,
          instruction: a.instruction as string,
          facts,
          verticalId: site.verticalId,
        });
        if (!res.ok) return { ok: false, summary: res.error };
        const next = blocks.map((b, j) => (j === i ? ({ ...b, props: res.props } as StoredBlock) : b));
        return persist(next, `Переписав вміст секції ${label(i)}`);
      }
      case "switch_theme": {
        const res = await switchTheme(host, a.presetId as string);
        if (!res.ok || !res.theme) return { ok: false, summary: res.error ?? "Невідомий пресет." };
        theme = res.theme;
        blocksChanged = true;
        const summary = "Змінив кольорове оформлення";
        actions.push(summary);
        return { ok: true, summary };
      }
      case "switch_pack": {
        const res = await switchDesignPack(host, a.packId as string);
        if (!res.ok || !res.blocks || !res.theme) return { ok: false, summary: res.error ?? "Невідомий пакет." };
        blocks = res.blocks;
        theme = res.theme;
        blocksChanged = true;
        const summary = "Змінив дизайн-пакет";
        actions.push(summary);
        return { ok: true, summary };
      }
    }
  }

  const system = buildEditorSystem({
    businessName: site.businessName,
    verticalId: site.verticalId,
    facts,
    blocks,
    themeOptions: site.themeOptions,
    isTemplateSite: Boolean(site.templateId),
    onboardingTranscript: onboarding,
    stats,
  });

  const apiMessages: Anthropic.MessageParam[] = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user" as const, content: userMessage },
  ];

  const client = getAnthropic();
  const enc = new TextEncoder();

  const rs = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));
      let finalText = "";
      try {
        for (let loop = 0; loop < MAX_LOOPS; loop++) {
          // System is rebuilt each round so the model sees blocks as mutated by
          // its own previous tool calls.
          const stream = client.messages.stream({
            model: CHAT_MODEL,
            max_tokens: 8000,
            thinking: { type: "enabled", budget_tokens: 3000 },
            system: loop === 0 ? system : buildEditorSystem({
              businessName: site.businessName,
              verticalId: site.verticalId,
              facts,
              blocks,
              themeOptions: site.themeOptions,
              isTemplateSite: Boolean(site.templateId),
              onboardingTranscript: onboarding,
              stats,
            }),
            tools: buildTools(),
            messages: apiMessages,
          });

          for await (const ev of stream) {
            if (ev.type === "content_block_start" && ev.content_block.type === "thinking") {
              send({ t: "think" });
            } else if (ev.type === "content_block_start" && ev.content_block.type === "tool_use") {
              send({ t: "tool", label: ev.content_block.name });
            } else if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
              finalText += ev.delta.text;
              send({ t: "d", text: ev.delta.text });
            }
          }

          const final = await stream.finalMessage();
          const toolUses = final.content.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
          );
          if (toolUses.length === 0) break;

          // Execute tools sequentially; feed results back (thinking blocks must
          // round-trip with the assistant turn — final.content carries them).
          apiMessages.push({ role: "assistant", content: final.content });
          const results: Anthropic.ToolResultBlockParam[] = [];
          for (const tu of toolUses) {
            const outcome = await runTool(tu.name as ToolName, tu.input);
            send({ t: "tooldone", summary: outcome.summary, ok: outcome.ok });
            results.push({
              type: "tool_result",
              tool_use_id: tu.id,
              content: outcome.ok ? `OK: ${outcome.summary}` : `ПОМИЛКА: ${outcome.summary}`,
              is_error: !outcome.ok,
            });
          }
          apiMessages.push({ role: "user", content: results });
          finalText += finalText ? "\n\n" : "";
        }

        const message = finalText.trim() || (actions.length ? "Готово — зміни в чернетці." : "Не впевнений, що зробити — уточніть, будь ласка.");

        // Persist memory (best-effort — works without the 0006 migration too).
        if (sb) {
          const userTurn: EditorChatMsg = { role: "user", content: userMessage };
          const assistantTurn: EditorChatMsg = {
            role: "assistant",
            content: actions.length ? `${message}\n\n[Дії: ${actions.join("; ")}]` : message,
          };
          const newHistory: EditorChatMsg[] = [...history, userTurn, assistantTurn].slice(-HISTORY_LIMIT * 2);
          await sb
            .from("editor_chats")
            .upsert(
              { tenant_id: site.tenantId, messages: newHistory, updated_at: new Date().toISOString() },
              { onConflict: "tenant_id" },
            )
            .then(() => undefined, () => undefined);
        }

        send({ t: "final", message, actions, blocksChanged, blocks, theme });
      } catch {
        send({ t: "error", message: "Щось пішло не так. Спробуйте ще раз." });
      } finally {
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
