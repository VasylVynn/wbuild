import Link from "next/link";
import { ArrowRight, Eye, Globe, Inbox, Plus } from "lucide-react";
import { Card, Chip } from "@/components/ui";

/**
 * Dashboard home content (P1): stats from site_events/leads, the user's sites,
 * the freshest leads. Pure presentation — the page assembles the data.
 */

export interface DashSite {
  id: string;
  host: string;
  url: string;
  name: string;
  statusLabel: string;
  statusTone: "ok" | "warn" | "danger" | "neutral";
  verticalLabel: string;
}

export interface DashLead {
  id: string;
  name: string;
  phone: string | null;
  message: string | null;
  siteLabel: string;
  createdAt: string;
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card className="flex items-center gap-4 p-5">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-sunken text-ink-muted">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[24px] font-bold leading-tight text-ink">{value}</div>
        <div className="truncate text-[13px] font-semibold text-ink-muted">{label}</div>
      </div>
    </Card>
  );
}

function SectionHeader({ title, href, linkLabel }: { title: string; href: string; linkLabel: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-[17px] font-bold text-ink">{title}</h2>
      <Link
        href={href}
        className="inline-flex items-center gap-1 text-[14px] font-semibold text-brand transition-colors hover:text-brand-hover"
      >
        {linkLabel} <ArrowRight size={14} />
      </Link>
    </div>
  );
}

export default function DashboardHome({
  greetName,
  stats,
  sites,
  leads,
}: {
  greetName: string | null;
  stats: { views7: number; leads7: number; sitesTotal: number };
  sites: DashSite[];
  leads: DashLead[];
}) {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-brand text-[24px] font-medium text-ink">Панель</h1>
        {greetName && <p className="mt-1 text-[14px] text-ink-muted">{greetName}</p>}
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <StatCard icon={<Eye size={20} />} label="Переглядів за 7 днів" value={stats.views7} />
        <StatCard icon={<Inbox size={20} />} label="Заявок за 7 днів" value={stats.leads7} />
        <StatCard icon={<Globe size={20} />} label="Сайтів" value={stats.sitesTotal} />
      </div>

      <section>
        <SectionHeader title="Мої сайти" href="/sites" linkLabel="Усі" />
        {sites.length === 0 ? (
          <Card className="flex flex-col items-start gap-3 p-6">
            <p className="text-[15px] text-ink-muted">
              Ще немає сайтів. Створіть перший у розмові з помічником — це займе близько трьох
              хвилин.
            </p>
            <Link
              href="/new"
              className="inline-flex min-h-[40px] items-center gap-2 rounded-[12px] bg-brand px-4 text-[14px] font-semibold text-white transition-colors hover:bg-brand-hover"
            >
              <Plus size={16} /> Створити сайт
            </Link>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            {sites.map((s) => (
              <Card key={s.id} className="flex flex-col gap-2.5 p-5 transition-shadow hover:shadow-lg">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[16px] font-bold text-ink">{s.name}</span>
                  <Chip tone={s.statusTone}>{s.statusLabel}</Chip>
                </div>
                <div className="truncate text-[13px] font-semibold text-ink-muted">
                  {s.host} · {s.verticalLabel}
                </div>
                <div className="mt-1 flex items-center gap-4 text-[14px] font-semibold">
                  <Link href={`/edit/${encodeURIComponent(s.host)}`} className="text-brand hover:text-brand-hover">
                    Редагувати
                  </Link>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-ink-muted hover:text-ink"
                  >
                    Відкрити ↗
                  </a>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {leads.length > 0 && (
        <section>
          <SectionHeader title="Останні заявки" href="/leads" linkLabel="Усі" />
          <Card className="divide-y divide-line">
            {leads.map((l) => (
              <div key={l.id} className="flex flex-col gap-1 px-5 py-3.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-[15px] font-bold text-ink">{l.name}</span>
                  <span className="shrink-0 text-[12px] font-semibold text-ink-faint">{l.createdAt}</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px]">
                  {l.phone && (
                    <a href={`tel:${l.phone}`} className="font-semibold text-brand hover:underline">
                      {l.phone}
                    </a>
                  )}
                  {l.message && <span className="truncate text-ink-muted">{l.message}</span>}
                </div>
                <span className="text-[12px] font-semibold text-ink-faint">{l.siteLabel}</span>
              </div>
            ))}
          </Card>
        </section>
      )}
    </div>
  );
}
