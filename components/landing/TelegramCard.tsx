import { Send } from "lucide-react";

/**
 * The payoff of the whole funnel, drawn as the Telegram notification the owner
 * actually receives (§«lead form → Telegram»). Used in the hero, the Telegram
 * band and the auth brand panel — `compact` is the hero/overlay size.
 */
export function TelegramCard({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`rounded-2xl border border-line bg-surface shadow-card ${compact ? "p-3" : "p-4"}`}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-tg text-white">
          <Send size={compact ? 16 : 20} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className={`font-bold text-ink ${compact ? "text-[12px]" : "text-[14px]"}`}>
              3minsite • Заявки
            </span>
            <span className="text-[10px] text-ink-muted">зараз</span>
          </div>
          <p className={`mt-1 leading-snug text-ink ${compact ? "text-[11px]" : "text-[14px]"}`}>
            <span className="font-semibold">Нова заявка!</span> Марина, +380 67 214 88 12 — «Хочу
            букет на весілля 🌸»
          </p>
          {!compact && (
            <div className="mt-3 flex gap-2">
              <span className="rounded-lg bg-brand px-3 py-1.5 text-[12px] font-semibold text-white">
                Відповісти
              </span>
              <span className="rounded-lg bg-sunken px-3 py-1.5 text-[12px] font-medium text-ink-muted">
                Пізніше
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
