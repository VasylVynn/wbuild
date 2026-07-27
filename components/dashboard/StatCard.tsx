import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui";

/**
 * Dashboard metric tile: label + icon bubble on top, the number below, an
 * optional period hint. `accent` paints the bubble honey — reserved for the
 * one metric that matters most (leads).
 */
export default function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent,
  className = "",
}: {
  label: string;
  value: number | string;
  hint?: string;
  icon: LucideIcon;
  accent?: boolean;
  className?: string;
}) {
  return (
    <Card className={`p-4 sm:p-5 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-[13px] font-semibold text-ink-muted">{label}</span>
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
            accent ? "bg-honey text-honey-text" : "bg-sunken text-ink"
          }`}
        >
          <Icon size={18} />
        </span>
      </div>
      <div className="mt-3 font-brand text-[26px] font-semibold leading-none tracking-tight text-ink tabular-nums sm:text-[30px]">
        {value}
      </div>
      {hint && <div className="mt-2 text-[12px] font-semibold text-ink-faint">{hint}</div>}
    </Card>
  );
}
