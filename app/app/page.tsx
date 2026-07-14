import Link from "next/link";
import { isAuthConfigured, getUser } from "@/lib/supabase/auth";
import { isPlatformAdmin } from "@/lib/admin";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { myTenantIds } from "@/lib/tenant/membership";
import { getVertical } from "@/lib/verticals/registry";
import { ROOT_DOMAIN } from "@/lib/config";
import { signOutAction } from "@/app/app/login/actions";
import AppShell from "@/components/dashboard/AppShell";
import DashboardHome, { type DashSite, type DashLead } from "@/components/dashboard/DashboardHome";
import { Wordmark } from "@/components/ui";

/**
 * Dashboard home (served on app.<root> — see middleware). Deliberately PUBLIC:
 * anonymous onboarding ("create a site without registering") starts here. A
 * signed-out visitor gets the splash with «Створити сайт»/«Увійти»; a signed-in
 * user (or auth-off degradation) gets the real dashboard inside AppShell.
 */

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; tone: "ok" | "warn" | "danger" | "neutral" }> = {
  published: { label: "Опубліковано", tone: "ok" },
  draft: { label: "Чернетка", tone: "warn" },
  demo: { label: "Демо", tone: "neutral" },
  suspended: { label: "Призупинено", tone: "danger" },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("uk-UA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

async function dashboardData() {
  const empty = { stats: { views7: 0, leads7: 0, sitesTotal: 0 }, sites: [] as DashSite[], leads: [] as DashLead[] };
  if (!isSupabaseConfigured()) return empty;

  // null = auth off → show all (degradation); [] = signed in, no sites yet.
  const ids = await myTenantIds();
  if (ids !== null && ids.length === 0) return empty;

  const sb = getServiceClient();
  const since7 = new Date(Date.now() - 7 * 86_400_000).toISOString();

  let viewsQ = sb.from("site_events").select("id", { count: "exact", head: true }).eq("kind", "view").gte("created_at", since7);
  if (ids !== null) viewsQ = viewsQ.in("tenant_id", ids);

  let leadsCountQ = sb.from("leads").select("id", { count: "exact", head: true }).gte("created_at", since7);
  if (ids !== null) leadsCountQ = leadsCountQ.in("tenant_id", ids);

  let sitesQ = sb
    .from("tenants")
    .select("id, host, status, vertical, brand, created_at")
    .not("host", "is", null)
    .order("created_at", { ascending: false });
  if (ids !== null) sitesQ = sitesQ.in("id", ids);

  let leadsQ = sb
    .from("leads")
    .select("id, name, phone, message, created_at, tenants(host, brand)")
    .order("created_at", { ascending: false })
    .limit(5);
  if (ids !== null) leadsQ = leadsQ.in("tenant_id", ids);

  const [viewsRes, leadsCountRes, sitesRes, leadsRes] = await Promise.all([viewsQ, leadsCountQ, sitesQ, leadsQ]);

  const isProd = process.env.NODE_ENV === "production";
  const port = ROOT_DOMAIN.includes(":") ? `:${ROOT_DOMAIN.split(":")[1]}` : "";
  const urlFor = (host: string) => `${isProd ? "https" : "http"}://${host}${isProd ? "" : port}`;

  interface TenantRow {
    id: string;
    host: string;
    status: string;
    vertical: string;
    brand: { businessName?: string } | null;
  }
  interface LeadRow {
    id: string;
    name: string | null;
    phone: string | null;
    message: string | null;
    created_at: string;
    tenants: { host: string | null; brand: { businessName?: string } | null } | null;
  }

  const allSites = (sitesRes.data ?? []) as unknown as TenantRow[];
  const sites: DashSite[] = allSites.slice(0, 4).map((s) => {
    const status = STATUS[s.status] ?? STATUS.demo;
    return {
      id: s.id,
      host: s.host,
      url: urlFor(s.host),
      name: s.brand?.businessName || s.host,
      statusLabel: status.label,
      statusTone: status.tone,
      verticalLabel: getVertical(s.vertical).label,
    };
  });

  const leads: DashLead[] = ((leadsRes.data ?? []) as unknown as LeadRow[]).map((l) => ({
    id: l.id,
    name: l.name || "Без імені",
    phone: l.phone,
    message: l.message,
    siteLabel: l.tenants?.brand?.businessName || l.tenants?.host || "—",
    createdAt: formatDate(l.created_at),
  }));

  return {
    stats: { views7: viewsRes.count ?? 0, leads7: leadsCountRes.count ?? 0, sitesTotal: allSites.length },
    sites,
    leads,
  };
}

// Link needs to render an <a>, so we mirror Button's look here directly.
const primaryLink =
  "inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[14px] bg-brand px-5 font-ui text-[15px] font-semibold text-white transition-colors hover:bg-brand-hover";
const secondaryLink =
  "inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-line-strong bg-surface px-5 font-ui text-[15px] font-semibold text-ink transition-colors hover:bg-sunken";

export default async function Dashboard() {
  const authOn = isAuthConfigured();
  const user = authOn ? await getUser() : null;

  // Signed-out visitor → splash. Auth-off degradation behaves as signed-in.
  if (authOn && !user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-3 bg-canvas px-6 py-24 text-center">
        <Wordmark className="text-[28px]" />
        <h1 className="mt-4 text-[17px] font-normal leading-relaxed text-ink-muted">
          Створіть свій сайт у простій розмові з помічником — і отримуйте заявки клієнтів у
          Telegram.
        </h1>
        <div className="mt-5 flex w-full max-w-sm flex-col gap-3">
          <Link href="/new" className={primaryLink}>
            Створити сайт
          </Link>
          <Link href="/login" className={secondaryLink}>
            Увійти
          </Link>
        </div>
      </main>
    );
  }

  const [admin, data] = await Promise.all([isPlatformAdmin(), dashboardData()]);
  return (
    <AppShell email={user?.email ?? null} admin={admin} signOut={signOutAction}>
      <DashboardHome greetName={user?.email ?? null} stats={data.stats} sites={data.sites} leads={data.leads} />
    </AppShell>
  );
}
