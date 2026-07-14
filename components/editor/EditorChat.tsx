"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Sparkles, Send, Check, CircleAlert, X } from "lucide-react";
import type { EditorChatMsg } from "@/lib/ai/editor-agent";
import type { StoredBlock } from "@/lib/blocks/schema";
import type { Theme } from "@/lib/theme/tokens";
import { getEditorChatHistory } from "@/app/app/(protected)/edit/chat-actions";

/**
 * Editor-agent chat panel (P3): the owner talks to one assistant (engineer +
 * copywriter + SEO advisor + analyst) that edits the DRAFT through validated
 * tools. Streaming: text paints live, tool calls show as action chips. After a
 * turn that changed blocks the shell gets fresh state + an undo snapshot.
 */

type StreamEvent =
  | { t: "think" }
  | { t: "d"; text: string }
  | { t: "tool"; label: string }
  | { t: "tooldone"; summary: string; ok: boolean }
  | { t: "final"; message: string; actions: string[]; blocksChanged: boolean; blocks: StoredBlock[]; theme: Theme }
  | { t: "error"; message: string }
  | { t: "refusal"; message: string };

type ChatItem =
  | { kind: "msg"; role: "user" | "assistant"; content: string }
  | { kind: "action"; summary: string; ok: boolean };

const SUGGESTIONS = [
  "Зроби тексти переконливішими",
  "Що додати, щоб було більше заявок?",
  "Прибери зайві секції",
  "Порадь, як покращити SEO",
];

function renderBold(text: string): ReactNode[] {
  return text
    .split(/\*\*([^*]+)\*\*/g)
    .map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part));
}

export default function EditorChat({
  host,
  getSnapshot,
  onApply,
  onUndoAvailable,
  onClose,
}: {
  host: string;
  /** Current blocks BEFORE the turn — the undo point. */
  getSnapshot: () => StoredBlock[];
  /** Fresh state after the agent changed the draft. */
  onApply: (blocks: StoredBlock[], theme: Theme) => void;
  /** Snapshot the shell can restore via «Скасувати». */
  onUndoAvailable: (snapshot: StoredBlock[]) => void;
  onClose: () => void;
}) {
  const [items, setItems] = useState<ChatItem[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<"idle" | "think" | "typing" | "acting">("idle");
  const endRef = useRef<HTMLDivElement>(null);
  const busyPaintRef = useRef(false);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items, stage]);

  // Memory: transcript survives reloads (editor_chats).
  useEffect(() => {
    void getEditorChatHistory(host).then((msgs) => {
      if (msgs.length) {
        setItems(
          msgs.map((m) => ({
            kind: "msg",
            role: m.role,
            // Stored assistant messages append "[Дії: …]" for the model's memory —
            // the UI shows clean text.
            content: m.content.replace(/\n*\[Дії: [^\]]*\]\s*$/, ""),
          })),
        );
      }
    });
  }, [host]);

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || busy) return;
    // Undo point: the draft as it is RIGHT NOW, before the agent touches it.
    const snapshot = getSnapshot();
    setInput("");
    setBusy(true);
    setStage("think");
    setItems((prev) => [...prev, { kind: "msg", role: "user", content: text }]);

    let acc = "";
    const paintAssistant = (content: string) => {
      setItems((prev) => {
        const next = prev.slice();
        const last = next[next.length - 1];
        if (last && last.kind === "msg" && last.role === "assistant" && busyPaintRef.current) {
          next[next.length - 1] = { kind: "msg", role: "assistant", content };
        } else {
          busyPaintRef.current = true;
          next.push({ kind: "msg", role: "assistant", content });
        }
        return next;
      });
    };

    try {
      const res = await fetch("/api/editor-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host, message: text }),
      });
      const ct = res.headers.get("content-type") ?? "";
      if (ct.includes("application/json")) {
        const j = (await res.json()) as { message?: string };
        setItems((prev) => [
          ...prev,
          { kind: "msg", role: "assistant", content: j.message ?? "Щось пішло не так." },
        ]);
        return;
      }
      if (!res.ok || !res.body) throw new Error(`stream ${res.status}`);

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let final: Extract<StreamEvent, { t: "final" }> | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const chunks = buf.split("\n\n");
        buf = chunks.pop() ?? "";
        for (const c of chunks) {
          const line = c.trim();
          if (!line.startsWith("data:")) continue;
          let ev: StreamEvent;
          try {
            ev = JSON.parse(line.slice(5));
          } catch {
            continue;
          }
          if (ev.t === "think") setStage("think");
          else if (ev.t === "d") {
            setStage("typing");
            acc += ev.text;
            paintAssistant(acc);
          } else if (ev.t === "tool") {
            setStage("acting");
          } else if (ev.t === "tooldone") {
            busyPaintRef.current = false;
            acc = "";
            setItems((prev) => [...prev, { kind: "action", summary: ev.summary, ok: ev.ok }]);
          } else if (ev.t === "final") {
            final = ev;
          } else if (ev.t === "error") {
            throw new Error(ev.message);
          }
        }
      }

      if (final) {
        busyPaintRef.current = false;
        // Canonical final text replaces whatever streamed last.
        setItems((prev) => {
          const next = prev.filter(
            (it, i) => !(i === prev.length - 1 && it.kind === "msg" && it.role === "assistant"),
          );
          return [...next, { kind: "msg", role: "assistant", content: final.message }];
        });
        if (final.blocksChanged) {
          onUndoAvailable(snapshot);
          onApply(final.blocks, final.theme);
        }
      }
    } catch {
      busyPaintRef.current = false;
      setItems((prev) => [
        ...prev,
        {
          kind: "msg",
          role: "assistant",
          content: "Не вдалося звʼязатися з помічником. Спробуйте ще раз.",
        },
      ]);
    } finally {
      setBusy(false);
      setStage("idle");
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-sunken px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-honey-soft text-honey-text">
            <Sparkles size={15} />
          </span>
          <div className="leading-tight">
            <div className="text-[14px] font-bold text-ink">Помічник сайту</div>
            <div className="text-[11px] font-semibold text-ink-faint">
              редактор · маркетолог · SEO
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрити чат"
          className="flex h-8 w-8 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-sunken hover:text-ink"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="flex flex-col gap-3">
          {items.length === 0 && (
            <div className="flex flex-col gap-2.5">
              <p className="text-[13px] leading-relaxed text-ink-muted">
                Я памʼятаю нашу розмову при створенні сайту і бачу всі секції. Попросіть змінити
                текст, прибрати чи додати секцію, переставити блоки — або спитайте поради.
              </p>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void send(s)}
                  className="rounded-[12px] border border-line bg-surface px-3 py-2 text-left text-[13px] font-semibold text-ink-muted transition-colors hover:border-brand hover:text-brand"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {items.map((it, i) =>
            it.kind === "action" ? (
              <div
                key={i}
                className={`flex items-center gap-2 self-start rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                  it.ok ? "bg-ok-soft text-ok" : "bg-danger-soft text-danger"
                }`}
              >
                {it.ok ? <Check size={12} /> : <CircleAlert size={12} />}
                {it.summary}
              </div>
            ) : (
              <div key={i} className={`flex ${it.role === "user" ? "justify-end" : "justify-start"}`}>
                <p
                  className={`max-w-[92%] whitespace-pre-wrap rounded-[14px] px-3.5 py-2.5 text-[13.5px] leading-relaxed ${
                    it.role === "user"
                      ? "bg-brand text-white"
                      : "border border-line bg-surface text-ink"
                  }`}
                >
                  {it.role === "user" ? it.content : renderBold(it.content)}
                </p>
              </div>
            ),
          )}

          {busy && stage !== "typing" && (
            <div className="flex items-center gap-2 self-start rounded-[14px] border border-line bg-surface px-3.5 py-2.5 text-[13px] font-semibold text-ink-muted">
              <span className="flex gap-1">
                {[0, 0.15, 0.3].map((d) => (
                  <span
                    key={d}
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-faint"
                    style={{ animationDelay: `${d}s` }}
                  />
                ))}
              </span>
              {stage === "acting" ? "Вношу зміни…" : "Думаю…"}
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      <div className="border-t border-sunken p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            rows={2}
            disabled={busy}
            placeholder="Напр.: додай секцію з відгуками…"
            className="min-h-[44px] flex-1 resize-none rounded-[12px] border border-line-strong bg-surface px-3 py-2.5 text-[13.5px] text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-soft disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => void send(input)}
            disabled={busy || !input.trim()}
            aria-label="Надіслати"
            className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-[12px] bg-brand text-white transition-colors hover:bg-brand-hover disabled:opacity-45"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
