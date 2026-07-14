"use client";

import { useMemo, useState } from "react";
import { Search, Send } from "lucide-react";
import { Card, Chip } from "@/components/ui";

/**
 * Leads list (P1): desktop = dense table with client-side search, mobile =
 * compact cards. Rows arrive pre-serialized from the server page (≤200), so
 * filtering in the browser is cheap and instant.
 */

export interface LeadItem {
  id: string;
  name: string;
  phone: string | null;
  message: string | null;
  siteLabel: string;
  pushed: boolean;
  createdAt: string;
}

export default function LeadsView({ leads }: { leads: LeadItem[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter((l) =>
      [l.name, l.phone ?? "", l.message ?? "", l.siteLabel].some((v) => v.toLowerCase().includes(q)),
    );
  }, [leads, query]);

  return (
    <div className="flex flex-col gap-4">
      <label className="relative block max-w-sm">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Пошук: імʼя, телефон, сайт…"
          className="w-full rounded-[12px] border border-line-strong bg-surface py-2 pl-9 pr-3.5 text-[14px] text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-soft"
        />
      </label>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-[14px] text-ink-muted">Нічого не знайдено.</p>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden overflow-hidden md:block">
            <table className="w-full text-left text-[14px]">
              <thead>
                <tr className="border-b border-line text-[12px] uppercase tracking-wide text-ink-faint">
                  <th className="px-5 py-3 font-semibold">Клієнт</th>
                  <th className="px-4 py-3 font-semibold">Телефон</th>
                  <th className="w-2/5 px-4 py-3 font-semibold">Повідомлення</th>
                  <th className="px-4 py-3 font-semibold">Сайт</th>
                  <th className="px-5 py-3 text-right font-semibold">Коли</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((l) => (
                  <tr key={l.id} className="align-top transition-colors hover:bg-sunken/60">
                    <td className="px-5 py-3.5 font-bold text-ink">
                      <span className="inline-flex items-center gap-1.5">
                        {l.name}
                        {l.pushed && <Send size={12} className="text-tg" aria-label="Надіслано в Telegram" />}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5">
                      {l.phone ? (
                        <a href={`tel:${l.phone}`} className="font-semibold text-brand hover:underline">
                          {l.phone}
                        </a>
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-ink-muted">
                      <span className="line-clamp-2">{l.message || "—"}</span>
                    </td>
                    <td className="px-4 py-3.5 text-ink-muted">{l.siteLabel}</td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right text-[13px] font-semibold text-ink-faint">
                      {l.createdAt}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Mobile cards */}
          <ul className="flex flex-col gap-3 md:hidden">
            {filtered.map((l) => (
              <li key={l.id}>
                <Card className="flex flex-col gap-2 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-[15px] font-bold text-ink">{l.name}</span>
                    <span className="shrink-0 text-[12px] font-semibold text-ink-faint">{l.createdAt}</span>
                  </div>
                  {l.phone && (
                    <a href={`tel:${l.phone}`} className="w-fit text-[15px] font-semibold text-brand hover:underline">
                      {l.phone}
                    </a>
                  )}
                  {l.message && <p className="text-[14px] leading-relaxed text-ink-muted">{l.message}</p>}
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip tone="neutral">{l.siteLabel}</Chip>
                    {l.pushed && (
                      <Chip tone="tg">
                        <Send size={11} /> у Telegram
                      </Chip>
                    )}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
