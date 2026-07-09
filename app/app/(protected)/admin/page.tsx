import Link from "next/link";
import { notFound } from "next/navigation";
import { isPlatformAdmin } from "@/lib/admin";
import { getServiceClient } from "@/lib/supabase/server";
import { getVertical } from "@/lib/verticals/registry";
import { ROOT_DOMAIN } from "@/lib/config";
import { Card, Chip } from "@/components/ui";
import SiteRow from "./SiteRow";

/**
 * Founders-only platform overview + kill-switch (gated by lib/admin.ts,
 * fail-closed). Always fresh — this is an operational console, not a cached
 * marketing surface — and reads through the SERVICE-ROLE client directly
 * (safe only because isPlatformAdmin() already ran).
 */
export const dynamic = "force-dynamic";

const SITES_CAP = 200;
const LEADS_CAP = 5000;

const STATUS: Record<string, { label: string; tone: "ok" | "warn" | "danger" | "neutral" }> = {
  published: { label: "Опубліковано", tone: "ok" },
  draft: { label: "Чернетка", tone: "warn" },
  demo: { label: "Демо", tone: "neutral" },
  suspended: { label: "Призупинено", tone: "danger" },
};

interface TenantRow {
  id: string;
  host: string | null;
  status: string;
  vertical: string;
  brand: { businessName?: string } | null;
  telegram_chat_id: string | null;
  created_at: string;
}

interface TenantLite {
  id: string;
  host: string | null;
  brand: { businessName?: string } | null;
  vertical: string;
}

interface CustomRequestRow {
  id: string;
  tenant_id: string;
  message: string;
  created_at: string;
}

interface ConversationRow {
  id: string;
  is_complete: boolean;
  facts_state: { facts?: { businessName?: string }; verticalId?: string } | null;
  created_at: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("uk-UA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function loadAdminData() {
  const sb = getServiceClient();

  const [
    sitesRes,
    leadsRes,
    totalLeadsRes,
    membersRes,
    draftlessRes,
    customRequestsRes,
    conversationsRes,
    conversationsTotalRes,
  ] = await Promise.all([
    sb
      .from("tenants")
      .select("id, host, status, vertical, brand, telegram_chat_id, created_at")
      .not("host", "is", null)
      .order("created_at", { ascending: false })
      .limit(SITES_CAP),
    sb.from("leads").select("tenant_id").limit(LEADS_CAP),
    sb.from("leads").select("id", { count: "exact", head: true }),
    sb.from("tenant_members").select("tenant_id, user_id"),
    sb.from("tenants").select("id", { count: "exact", head: true }).is("host", null),
    sb
      .from("custom_requests")
      .select("id, tenant_id, message, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
    sb
      .from("conversations")
      .select("id, is_complete, facts_state, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
    sb.from("conversations").select("id", { count: "exact", head: true }),
  ]);

  const sites = (sitesRes.data ?? []) as TenantRow[];

  const leadCounts = new Map<string, number>();
  const leadRows = (leadsRes.data ?? []) as { tenant_id: string }[];
  for (const row of leadRows) {
    leadCounts.set(row.tenant_id, (leadCounts.get(row.tenant_id) ?? 0) + 1);
  }

  // Owner emails: tenant_members → auth.users, joined in memory (no FK join
  // possible across schemas via PostgREST).
  const memberRows = (membersRes.data ?? []) as { tenant_id: string; user_id: string }[];
  const { data: usersPage } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const emailById = new Map<string, string>();
  for (const u of usersPage?.users ?? []) {
    if (u.email) emailById.set(u.id, u.email);
  }
  const ownerByTenant = new Map<string, string>();
  for (const m of memberRows) {
    const email = emailById.get(m.user_id);
    if (email) ownerByTenant.set(m.tenant_id, email);
  }

  // custom_requests may reference a tenant outside the (capped) sites list —
  // look those up separately so the label never falls back to "—" needlessly.
  const customRequests = (customRequestsRes.data ?? []) as CustomRequestRow[];
  const conversations = (conversationsRes.data ?? []) as ConversationRow[];
  const tenantLiteById = new Map<string, TenantLite>();
  for (const s of sites) {
    tenantLiteById.set(s.id, { id: s.id, host: s.host, brand: s.brand, vertical: s.vertical });
  }
  const extraIds = [
    ...new Set(customRequests.map((r) => r.tenant_id).filter((id) => !tenantLiteById.has(id))),
  ];
  if (extraIds.length > 0) {
    const { data: extra } = await sb
      .from("tenants")
      .select("id, host, brand, vertical")
      .in("id", extraIds);
    for (const t of (extra ?? []) as TenantLite[]) tenantLiteById.set(t.id, t);
  }

  return {
    sites,
    leadCounts,
    leadsAtCap: leadRows.length >= LEADS_CAP,
    sitesAtCap: sites.length >= SITES_CAP,
    ownerByTenant,
    draftlessCount: draftlessRes.count ?? 0,
    totalLeads: totalLeadsRes.count ?? 0,
    totalConversations: conversationsTotalRes.count ?? 0,
    customRequests,
    conversations,
    tenantLiteById,
  };
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <div className="text-[26px] font-extrabold text-ink">{value}</div>
      <div className="text-[13px] font-semibold text-ink-muted">{label}</div>
    </Card>
  );
}

export default async function AdminPage() {
  if (!(await isPlatformAdmin())) notFound();

  const {
    sites,
    leadCounts,
    leadsAtCap,
    sitesAtCap,
    ownerByTenant,
    draftlessCount,
    totalLeads,
    totalConversations,
    customRequests,
    conversations,
    tenantLiteById,
  } = await loadAdminData();

  const publishedCount = sites.filter((s) => s.status === "published").length;
  const isProd = process.env.NODE_ENV === "production";
  const port = ROOT_DOMAIN.includes(":") ? `:${ROOT_DOMAIN.split(":")[1]}` : "";
  const urlFor = (host: string) => `${isProd ? "https" : "http"}://${host}${isProd ? "" : port}`;

  return (
    <main className="mx-auto min-h-screen max-w-6xl bg-canvas px-6 py-12">
      <div className="mb-8">
        <Link href="/" className="text-[14px] font-bold text-ink-muted transition-colors hover:text-ink">
          ← Панель
        </Link>
        <h1 className="mt-1.5 font-brand text-[24px] font-medium text-ink">Адмінка</h1>
      </div>

      <div className="mb-10 grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Сайтів" value={sites.length} />
        <StatCard label="Опубліковано" value={publishedCount} />
        <StatCard label="Заявок" value={totalLeads} />
        <StatCard label="Розмов без сайту" value={draftlessCount} />
        <StatCard label="Розмов усього" value={totalConversations} />
      </div>

      <section className="mb-10">
        <h2 className="mb-3 font-brand text-[19px] font-medium text-ink">
          Сайти <span className="text-ink-faint">({sites.length})</span>
        </h2>
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[960px] border-collapse text-[14px]">
            <thead>
              <tr className="border-b border-line text-left text-[12px] font-bold uppercase tracking-wide text-ink-faint">
                <th className="px-4 py-3">Сайт</th>
                <th className="px-4 py-3">Бізнес</th>
                <th className="px-4 py-3">Напрям</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3">Заявок</th>
                <th className="px-4 py-3">Telegram</th>
                <th className="px-4 py-3">Власник</th>
                <th className="px-4 py-3">Створено</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {sites.map((s) => {
                const status = STATUS[s.status] ?? STATUS.demo;
                const host = s.host as string; // filtered by "host IS NOT NULL" above
                return (
                  <tr key={s.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3">
                      <a
                        href={urlFor(host)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-bold text-brand hover:underline"
                      >
                        {host}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-ink">{s.brand?.businessName || "—"}</td>
                    <td className="px-4 py-3 text-ink-muted">{getVertical(s.vertical).label}</td>
                    <td className="px-4 py-3">
                      <Chip tone={status.tone}>{status.label}</Chip>
                    </td>
                    <td className="px-4 py-3 text-ink">{leadCounts.get(s.id) ?? 0}</td>
                    <td className="px-4 py-3">{s.telegram_chat_id ? "✓" : "—"}</td>
                    <td className="px-4 py-3 text-ink-muted">{ownerByTenant.get(s.id) ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-ink-faint">
                      {formatDate(s.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <SiteRow tenantId={s.id} host={host} suspended={s.status === "suspended"} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
        <div className="mt-2 flex flex-col gap-0.5">
          {sitesAtCap && (
            <p className="text-[13px] text-ink-faint">(показано перші {SITES_CAP})</p>
          )}
          {leadsAtCap && (
            <p className="text-[13px] text-ink-faint">
              (показано по перших {LEADS_CAP} заявках)
            </p>
          )}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 font-brand text-[19px] font-medium text-ink">
          Останні запити на кастомні зміни
        </h2>
        {customRequests.length === 0 ? (
          <p className="text-[14px] text-ink-faint">Ще немає запитів.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {customRequests.map((r) => {
              const t = tenantLiteById.get(r.tenant_id);
              const name = t?.brand?.businessName || t?.host || "—";
              return (
                <li key={r.id}>
                  <Card className="flex flex-col gap-2 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="font-bold text-ink">
                        {name}
                        {t?.host ? ` · ${t.host}` : ""}
                      </span>
                      <span className="whitespace-nowrap text-[13px] font-semibold text-ink-faint">
                        {formatDate(r.created_at)}
                      </span>
                    </div>
                    <p className="text-[14px] text-ink-muted">{r.message}</p>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-brand text-[19px] font-medium text-ink">Останні розмови</h2>
        {conversations.length === 0 ? (
          <p className="text-[14px] text-ink-faint">Ще немає розмов.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {conversations.map((c) => {
              const businessName = c.facts_state?.facts?.businessName;
              const verticalId = c.facts_state?.verticalId;
              return (
                <li key={c.id}>
                  <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div>
                      <span className="font-bold text-ink">{businessName || "Без назви"}</span>
                      {verticalId && (
                        <span className="ml-2 text-[13px] text-ink-muted">
                          {getVertical(verticalId).label}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Chip tone={c.is_complete ? "ok" : "neutral"}>
                        {c.is_complete ? "завершено" : "у процесі"}
                      </Chip>
                      <span className="whitespace-nowrap text-[13px] font-semibold text-ink-faint">
                        {formatDate(c.created_at)}
                      </span>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
