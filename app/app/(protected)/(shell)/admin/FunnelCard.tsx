import { Card } from "@/components/ui";
import { getFunnelStats } from "./funnel-actions";
import type { FunnelKind } from "@/lib/analytics/funnel";

/**
 * Paid-funnel counters for the admin console (spec 2026-08-05 §5): where people
 * drop out between «почали чат» and «оплатили», over 7 and 30 days.
 *
 * Self-contained async server component — mount it anywhere on /admin, it
 * fetches and gates itself (getFunnelStats re-checks isPlatformAdmin) and
 * renders nothing when there is nothing to show: no Supabase env, no admin, or
 * an empty funnel. Conversion is measured against chat_start, the first step we
 * can actually count server-side; landing views live in the Meta Pixel, not here.
 */

const LABELS: Record<FunnelKind, string> = {
  chat_start: "Почали чат",
  draft_generated: "Отримали сайт",
  publish_clicked: "Натиснули «Опублікувати»",
  checkout_created: "Перейшли до оплати",
  payment_success: "Оплатили",
  domain_requested: "Обрали домен",
};

function money(uah: number): string {
  return new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 0 }).format(uah);
}

export default async function FunnelCard() {
  const stats = await getFunnelStats();
  if (!stats) return null;

  const byKind = new Map(stats.steps.map((s) => [s.kind, s]));
  const base7 = byKind.get("chat_start")?.d7 ?? 0;
  const base30 = byKind.get("chat_start")?.d30 ?? 0;
  if (base30 === 0 && stats.paid.d30.count === 0) return null;

  const share = (value: number, base: number) =>
    base > 0 ? `${Math.round((value / base) * 100)}%` : "—";

  return (
    <section className="mb-10">
      <h2 className="mb-3 font-brand text-[19px] font-medium text-ink">Воронка</h2>
      <Card className="overflow-hidden p-0">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-line text-left text-[11px] font-bold uppercase tracking-wide text-ink-faint">
              <th className="px-3.5 py-2.5">Крок</th>
              <th className="px-3.5 py-2.5 text-right">7 днів</th>
              <th className="px-3.5 py-2.5 text-right">30 днів</th>
              <th className="px-3.5 py-2.5 text-right">Конверсія (30д)</th>
            </tr>
          </thead>
          <tbody>
            {stats.steps.map((step) => (
              <tr key={step.kind} className="border-b border-line last:border-0">
                <td className="px-3.5 py-2.5 font-semibold text-ink">{LABELS[step.kind]}</td>
                <td className="px-3.5 py-2.5 text-right tabular-nums text-ink">{step.d7}</td>
                <td className="px-3.5 py-2.5 text-right tabular-nums text-ink">{step.d30}</td>
                <td className="px-3.5 py-2.5 text-right tabular-nums text-ink-muted">
                  {share(step.d30, base30)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t border-line bg-sunken px-3.5 py-3">
          <span className="text-[13px] font-bold text-ink">
            Оплат: {stats.paid.d30.count} на ₴{money(stats.paid.d30.sum)}
            <span className="ml-1.5 font-semibold text-ink-faint">за 30 днів</span>
          </span>
          <span className="text-[13px] font-semibold text-ink-muted">
            За 7 днів: {stats.paid.d7.count} на ₴{money(stats.paid.d7.sum)} · конверсія з чату{" "}
            {share(byKind.get("payment_success")?.d7 ?? 0, base7)}
          </span>
        </div>
      </Card>
      {stats.capped && (
        <p className="mt-2 text-[13px] text-ink-faint">
          (подій за 30 днів більше, ніж уміщує вибірка — показано найновіші)
        </p>
      )}
    </section>
  );
}
