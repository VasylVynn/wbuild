import Link from "next/link";
import { ArrowRight, Eye, Globe, Inbox, Plus } from "lucide-react";
import { Card, EmptyState } from "@/components/ui";
import StatCard from "@/components/dashboard/StatCard";
import SiteCard from "@/components/dashboard/SiteCard";
import LeadList from "@/components/dashboard/LeadList";

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

// Link needs to render an <a>, so we mirror Button's look here directly.
const primaryPill =
  "inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-full bg-brand px-5 font-ui text-[15px] font-semibold text-white transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-honey-deep focus-visible:ring-offset-2";

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
  const hasLeads = leads.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-brand text-[26px] font-semibold leading-tight tracking-tight text-ink sm:text-[30px]">
            Вітаємо!
          </h1>
          <p className="mt-1.5 text-[15px] leading-relaxed text-ink-muted">
            Ось що відбувається з вашими сайтами.
          </p>
          {greetName && (
            <p className="mt-0.5 truncate text-[13px] font-semibold text-ink-faint">{greetName}</p>
          )}
        </div>
        <Link href="/new" className={primaryPill}>
          <Plus size={16} /> Новий сайт
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard label="Заявки" value={stats.leads7} hint="за 7 днів" icon={Inbox} accent />
        <StatCard label="Перегляди" value={stats.views7} hint="за 7 днів" icon={Eye} />
        <StatCard
          label="Сайти"
          value={stats.sitesTotal}
          hint="усього"
          icon={Globe}
          className="col-span-2 lg:col-span-1"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <section className={hasLeads ? "lg:col-span-3" : "lg:col-span-5"}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-brand text-[18px] font-semibold text-ink">Ваші сайти</h2>
            <Link
              href="/sites"
              className="inline-flex items-center gap-1 text-[14px] font-semibold text-ink transition-colors hover:text-ink-muted"
            >
              Усі <ArrowRight size={14} />
            </Link>
          </div>

          {sites.length === 0 ? (
            <EmptyState icon={<Globe size={20} />} title="Ще немає сайтів">
              Створіть перший у розмові з помічником — це займе близько трьох хвилин.
              <div className="mt-4">
                <Link href="/new" className={`${primaryPill} w-full sm:w-auto`}>
                  <Plus size={16} /> Створити сайт
                </Link>
              </div>
            </EmptyState>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {sites.map((s) => (
                <SiteCard
                  key={s.id}
                  name={s.name}
                  host={s.host}
                  url={s.url}
                  editHref={`/edit/${encodeURIComponent(s.host)}`}
                  statusLabel={s.statusLabel}
                  statusTone={s.statusTone}
                  verticalLabel={s.verticalLabel}
                />
              ))}
            </div>
          )}
        </section>

        {hasLeads && (
          <Card className="p-5 lg:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-brand text-[18px] font-semibold text-ink">Останні заявки</h2>
              <Link
                href="/leads"
                className="inline-flex items-center gap-1 text-[14px] font-semibold text-ink transition-colors hover:text-ink-muted"
              >
                Усі <ArrowRight size={14} />
              </Link>
            </div>
            <LeadList leads={leads} className="mt-2" />
          </Card>
        )}
      </div>
    </div>
  );
}
