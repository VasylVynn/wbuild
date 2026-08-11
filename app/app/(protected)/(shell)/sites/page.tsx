import Link from "next/link";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { myTenantIds } from "@/lib/tenant/membership";
import { getVertical } from "@/lib/verticals/registry";
import { ROOT_DOMAIN } from "@/lib/config";
import TelegramConnect from "@/components/dashboard/TelegramConnect";
import DomainRow from "@/components/dashboard/DomainRow";
import SiteCard from "@/components/dashboard/SiteCard";
import { Globe, Plus } from "lucide-react";
import { EmptyState } from "@/components/ui";

// Always show the current list — new sites appear immediately.
export const dynamic = "force-dynamic";

interface SiteRow {
  id: string;
  host: string | null;
  status: string;
  vertical: string;
  brand: { businessName?: string } | null;
  created_at: string;
  telegram_chat_id: string | null;
  custom_domain: string | null;
  requested_domain: string | null;
  domain_status: string | null;
}

async function listSites(): Promise<SiteRow[]> {
  if (!isSupabaseConfigured()) return [];

  // Scope to the current user's sites (§3.1). null = auth off → show all
  // (degradation); [] = signed in with no sites yet.
  const ids = await myTenantIds();
  if (ids !== null && ids.length === 0) return [];

  const sb = getServiceClient();
  let query = sb
    .from("tenants")
    .select(
      "id, host, status, vertical, brand, created_at, telegram_chat_id, custom_domain, requested_domain, domain_status",
    )
    .order("created_at", { ascending: false });
  if (ids !== null) query = query.in("id", ids);
  const { data, error } = await query;
  if (error || !data) return [];
  return (data as SiteRow[]).filter((s) => !!s.host);
}

const STATUS: Record<string, { label: string; tone: "ok" | "warn" | "danger" | "neutral" }> = {
  published: { label: "Опубліковано", tone: "ok" },
  draft: { label: "Чернетка", tone: "warn" },
  demo: { label: "Демо", tone: "neutral" },
  suspended: { label: "Призупинено", tone: "danger" },
};

// Link needs to render an <a>, so we mirror Button's look here directly
// rather than nesting a <button> inside it (invalid HTML).
const primaryPill =
  "inline-flex shrink-0 min-h-[44px] items-center justify-center gap-2 rounded-full bg-brand px-5 font-ui text-[15px] font-semibold text-white transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-honey-deep focus-visible:ring-offset-2";

export default async function SitesPage() {
  const sites = await listSites();
  const isProd = process.env.NODE_ENV === "production";
  const port = ROOT_DOMAIN.includes(":") ? `:${ROOT_DOMAIN.split(":")[1]}` : "";
  const urlFor = (host: string) => `${isProd ? "https" : "http"}://${host}${isProd ? "" : port}`;

  return (
    <div className="flex flex-col gap-6">
      {/* Binds sites created anonymously before the user registered (§3.1). */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-brand text-[26px] font-semibold leading-tight tracking-tight text-ink sm:text-[30px]">
            Мої сайти <span className="text-ink-faint">({sites.length})</span>
          </h1>
          <p className="mt-1.5 text-[15px] leading-relaxed text-ink-muted">
            Редагуйте вміст і підключайте Telegram, щоб заявки приходили миттєво.
          </p>
        </div>
        <Link href="/new" className={primaryPill}>
          <Plus size={16} /> Створити сайт
        </Link>
      </div>

      {sites.length === 0 ? (
        <EmptyState icon={<Globe size={20} />} title="Ще немає сайтів">
          Створіть перший у простій розмові з помічником — це займе близько трьох хвилин.
          <div className="mt-4">
            <Link href="/new" className={`${primaryPill} w-full sm:w-auto`}>
              <Plus size={16} /> Створити сайт
            </Link>
          </div>
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sites.map((s) => {
            const status = STATUS[s.status] ?? STATUS.demo;
            const name = s.brand?.businessName || s.host!;
            return (
              <li key={s.id}>
                <SiteCard
                  name={name}
                  host={s.host!}
                  url={urlFor(s.host!)}
                  editHref={`/edit/${encodeURIComponent(s.host!)}`}
                  statusLabel={status.label}
                  statusTone={status.tone}
                  verticalLabel={getVertical(s.vertical).label}
                  footer={
                    <div className="flex flex-col gap-2">
                      <TelegramConnect tenantId={s.id} connected={!!s.telegram_chat_id} />
                      {/* The ₴999 domain had exactly ONE mount in the product —
                          the post-publish moment — and skipping it there was
                          final: no route could offer it again. A site the owner
                          keeps coming back to is where the offer belongs. */}
                      <DomainRow
                        host={s.host!}
                        status={s.domain_status}
                        customDomain={s.custom_domain}
                        requestedDomain={s.requested_domain}
                      />
                    </div>
                  }
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
