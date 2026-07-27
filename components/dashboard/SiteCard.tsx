import Link from "next/link";
import type { ReactNode } from "react";
import { ExternalLink, Pencil } from "lucide-react";
import { Chip } from "@/components/ui";

/**
 * One site in the dashboard/sites grids: a coloured banner carrying the name,
 * then host + actions. `footer` is the slot the sites page fills with the
 * Telegram connect control.
 */

export interface SiteCardProps {
  name: string;
  host: string;
  /** Public URL of the live site (opens in a new tab). */
  url: string;
  editHref: string;
  statusLabel: string;
  statusTone: "ok" | "warn" | "danger" | "neutral";
  verticalLabel: string;
  footer?: ReactNode;
}

/**
 * No per-site colour exists in the data, so the banner hue is derived from the
 * host — stable per site, and clamped to the warm gold/olive range so the grid
 * stays inside the honey family instead of turning into a rainbow.
 */
function bannerStyle(seed: string) {
  let acc = 0;
  for (let i = 0; i < seed.length; i++) acc = (acc * 31 + seed.charCodeAt(i)) % 60;
  const hue = 55 + acc;
  return {
    background: `linear-gradient(135deg, oklch(0.62 0.13 ${hue}), oklch(0.82 0.1 ${hue + 18}))`,
  };
}

export default function SiteCard({
  name,
  host,
  url,
  editHref,
  statusLabel,
  statusTone,
  verticalLabel,
  footer,
}: SiteCardProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[20px] border border-line bg-surface shadow-card transition-shadow hover:shadow-lg">
      <div className="relative h-28 w-full" style={bannerStyle(host)}>
        <div className="absolute inset-0 flex flex-col justify-end gap-0.5 p-4">
          <span className="truncate text-[11px] font-bold uppercase tracking-wide text-white/85">
            {verticalLabel}
          </span>
          <span className="truncate font-brand text-[17px] font-semibold text-white">{name}</span>
        </div>
        <Chip tone={statusTone} className="absolute right-3 top-3 bg-surface/95">
          {statusLabel}
        </Chip>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <span className="truncate text-[13px] font-semibold text-ink-muted">{host}</span>

        <div className="flex items-center gap-2">
          <Link
            href={editHref}
            className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-2 rounded-[12px] bg-brand px-4 font-ui text-[14px] font-semibold text-white transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-honey-deep focus-visible:ring-offset-2"
          >
            <Pencil size={15} /> Редагувати
          </Link>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Відкрити сайт у новій вкладці"
            title="Відкрити сайт"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border-[1.5px] border-line-strong bg-surface text-ink transition-colors hover:bg-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-honey-deep focus-visible:ring-offset-2"
          >
            <ExternalLink size={16} />
          </a>
        </div>

        {footer && <div className="mt-auto pt-1">{footer}</div>}
      </div>
    </div>
  );
}
