import { Phone, Send } from "lucide-react";

/**
 * Shared lead row list — the dashboard's «Останні заявки» panel and the full
 * leads screen render the same rows. Pure presentation; every field arrives
 * pre-serialized from the server page.
 */

export interface LeadListItem {
  id: string;
  name: string;
  phone: string | null;
  message: string | null;
  siteLabel: string;
  createdAt: string;
  /** Lead was pushed to the owner's Telegram. */
  pushed?: boolean;
}

function initials(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("");
  return letters.toUpperCase() || "?";
}

export default function LeadList({
  leads,
  className = "",
}: {
  leads: LeadListItem[];
  className?: string;
}) {
  return (
    <ul className={`divide-y divide-line ${className}`}>
      {leads.map((lead) => (
        <li key={lead.id} className="flex gap-3 py-4 first:pt-0 last:pb-0">
          <span
            aria-hidden
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-honey/30 text-[13px] font-extrabold text-honey-text"
          >
            {initials(lead.name)}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="truncate text-[15px] font-bold text-ink">{lead.name}</span>
              <span className="text-[12px] font-semibold text-ink-faint">{lead.createdAt}</span>
            </div>

            {lead.message && (
              <p className="mt-1 line-clamp-2 text-[14px] leading-relaxed text-ink-muted">
                {lead.message}
              </p>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] font-semibold text-ink-faint">
              {lead.phone && (
                <a
                  href={`tel:${lead.phone}`}
                  className="flex items-center gap-1.5 text-[13px] text-ink hover:underline"
                >
                  <Phone size={13} className="shrink-0" />
                  {lead.phone}
                </a>
              )}
              <span className="truncate">{lead.siteLabel}</span>
              {lead.pushed && (
                <span className="flex items-center gap-1 text-tg-dark">
                  <Send size={13} className="shrink-0" /> у Telegram
                </span>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
