"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Card } from "@/components/ui";
import LeadList from "@/components/dashboard/LeadList";

/**
 * Leads list (P1): one row list at every breakpoint, with client-side search.
 * Rows arrive pre-serialized from the server page (≤200), so filtering in the
 * browser is cheap and instant.
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
      <label className="relative block sm:max-w-xs">
        <Search
          size={16}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Пошук: імʼя, телефон, сайт…"
          className="min-h-[44px] w-full rounded-full border border-line-strong bg-surface py-2 pl-10 pr-4 text-[15px] text-ink placeholder:text-ink-faint focus:border-honey-deep focus:outline-none focus:ring-2 focus:ring-honey-soft"
        />
      </label>

      {filtered.length === 0 ? (
        <div className="rounded-[20px] border border-dashed border-line-strong px-6 py-14 text-center">
          <p className="text-[15px] text-ink-muted">Заявок не знайдено. Спробуйте інший запит.</p>
        </div>
      ) : (
        <Card className="p-5 sm:p-6">
          <LeadList leads={filtered} />
        </Card>
      )}
    </div>
  );
}
