import Link from "next/link";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { myTenantIds } from "@/lib/tenant/membership";
import { Card, Chip, EmptyState } from "@/components/ui";

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

  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-canvas px-6 py-12">
      <div className="mb-8">
        <Link href="/" className="text-[14px] font-bold text-ink-muted transition-colors hover:text-ink">
          ← Панель
        </Link>
        <h1 className="mt-1.5 font-brand text-[24px] font-medium text-ink">
          Заявки <span className="text-ink-faint">({leads.length})</span>
        </h1>
      </div>

      {leads.length === 0 ? (
        <EmptyState emoji="📭" title="Ще немає заявок">
          Коли клієнт залишить заявку на вашому сайті, вона зʼявиться тут — і прийде вам у Telegram.
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-3.5">
          {leads.map((lead) => {
            const siteName = lead.tenants?.brand?.businessName || lead.tenants?.host || "—";
            const siteHost = lead.tenants?.host;
            const siteLabel =
              siteHost && siteName !== siteHost ? `${siteName} · ${siteHost}` : siteName;
            return (
              <li key={lead.id}>
                <Card className="flex flex-col gap-3 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[18px] font-extrabold text-ink">
                      {lead.name || "Без імені"}
                    </span>
                    <span className="whitespace-nowrap text-[13px] font-bold text-ink-faint">
                      {formatDate(lead.created_at)}
                    </span>
                  </div>

                  {lead.phone && (
                    <a
                      href={`tel:${lead.phone}`}
                      className="inline-flex w-fit items-center gap-2 self-start rounded-full bg-brand-soft px-5 py-3 text-[18px] font-extrabold text-brand no-underline"
                    >
                      {lead.phone}
                    </a>
                  )}

                  {lead.message && (
                    <p className="text-[16px] leading-relaxed text-ink">{lead.message}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    <Chip tone="neutral">{siteLabel}</Chip>
                    {lead.pushed_at && <Chip tone="tg">✈️ надіслано в Telegram</Chip>}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
