import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { myTenantIds } from "@/lib/tenant/membership";
import { Inbox } from "lucide-react";
import { EmptyState } from "@/components/ui";
import LeadsView, { type LeadItem } from "@/components/dashboard/LeadsView";

// Always show fresh leads — no caching.
export const dynamic = "force-dynamic";

interface LeadRow {
  id: string;
  name: string | null;
  phone: string | null;
  message: string | null;
  pushed_at: string | null;
  created_at: string;
  tenants: { host: string | null; brand: { businessName?: string } | null } | null;
}

async function listLeads(): Promise<LeadRow[]> {
  if (!isSupabaseConfigured()) return [];

  // Only leads for the user's own sites (§3.1). null = auth off → all
  // (degradation); [] = signed in with no sites.
  const ids = await myTenantIds();
  if (ids !== null && ids.length === 0) return [];

  const sb = getServiceClient();
  let query = sb
    .from("leads")
    .select("id, name, phone, message, pushed_at, created_at, tenants(host, brand)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (ids !== null) query = query.in("tenant_id", ids);
  const { data, error } = await query;
  if (error || !data) return [];
  return data as unknown as LeadRow[];
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

export default async function LeadsPage() {
  const leads = await listLeads();

  const items: LeadItem[] = leads.map((lead) => {
    const siteName = lead.tenants?.brand?.businessName || lead.tenants?.host || "—";
    const siteHost = lead.tenants?.host;
    return {
      id: lead.id,
      name: lead.name || "Без імені",
      phone: lead.phone,
      message: lead.message,
      siteLabel: siteHost && siteName !== siteHost ? `${siteName} · ${siteHost}` : siteName,
      pushed: !!lead.pushed_at,
      createdAt: formatDate(lead.created_at),
    };
  });

  return (
    <div>
      <h1 className="mb-6 font-brand text-[24px] font-medium text-ink">
        Заявки <span className="text-ink-faint">({leads.length})</span>
      </h1>

      {items.length === 0 ? (
        <EmptyState icon={<Inbox size={20} />} title="Ще немає заявок">
          Коли клієнт залишить заявку на вашому сайті, вона зʼявиться тут — і прийде вам у Telegram.
        </EmptyState>
      ) : (
        <LeadsView leads={items} />
      )}
    </div>
  );
}
