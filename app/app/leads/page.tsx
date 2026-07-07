import Link from "next/link";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";

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
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("leads")
    .select("id, name, phone, message, pushed_at, created_at, tenants(host, brand)")
    .order("created_at", { ascending: false })
    .limit(200);
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
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-12">
      <div className="mb-8">
        <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-800">
          ← Панель
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-neutral-900">
          Заявки <span className="text-neutral-400">({leads.length})</span>
        </h1>
      </div>

      {leads.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 px-6 py-16 text-center text-neutral-500">
          Ще немає заявок…
        </div>
      ) : (
        <ul className="space-y-3">
          {leads.map((lead) => {
            const siteName =
              lead.tenants?.brand?.businessName || lead.tenants?.host || "—";
            const siteHost = lead.tenants?.host;
            return (
              <li
                key={lead.id}
                className="rounded-2xl border border-neutral-200 bg-white px-5 py-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    {/* Name + Telegram badge */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-lg font-semibold text-neutral-900">
                        {lead.name || "Без імені"}
                      </span>
                      {lead.pushed_at && (
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                          ✈️ надіслано в Telegram
                        </span>
                      )}
                    </div>

                    {/* Phone */}
                    {lead.phone && (
                      <a
                        href={`tel:${lead.phone}`}
                        className="mt-1 inline-block text-base font-medium text-neutral-800 underline decoration-neutral-300 hover:decoration-neutral-700"
                      >
                        {lead.phone}
                      </a>
                    )}

                    {/* Message */}
                    {lead.message && (
                      <p className="mt-2 text-sm text-neutral-600">{lead.message}</p>
                    )}
                  </div>

                  {/* Site chip + date */}
                  <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
                      {siteName}
                      {siteHost && siteName !== siteHost && (
                        <span className="ml-1 text-neutral-400">{siteHost}</span>
                      )}
                    </span>
                    <span className="text-xs text-neutral-400">
                      {formatDate(lead.created_at)}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
