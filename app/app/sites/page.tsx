import Link from "next/link";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getVertical } from "@/lib/verticals/registry";
import { ROOT_DOMAIN } from "@/lib/config";

// Always show the current list — new sites appear immediately.
export const dynamic = "force-dynamic";

interface SiteRow {
  id: string;
  host: string | null;
  status: string;
  vertical: string;
  brand: { businessName?: string } | null;
  created_at: string;
}

async function listSites(): Promise<SiteRow[]> {
  if (!isSupabaseConfigured()) return [];
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("tenants")
    .select("id, host, status, vertical, brand, created_at")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as SiteRow[]).filter((s) => !!s.host);
}

const STATUS: Record<string, { label: string; cls: string }> = {
  published: { label: "Опубліковано", cls: "bg-green-100 text-green-800" },
  draft: { label: "Чернетка", cls: "bg-amber-100 text-amber-800" },
  demo: { label: "Демо", cls: "bg-neutral-100 text-neutral-600" },
  suspended: { label: "Призупинено", cls: "bg-red-100 text-red-700" },
};

export default async function SitesPage() {
  const sites = await listSites();
  const isProd = process.env.NODE_ENV === "production";
  const port = ROOT_DOMAIN.includes(":") ? `:${ROOT_DOMAIN.split(":")[1]}` : "";
  const urlFor = (host: string) => `${isProd ? "https" : "http"}://${host}${isProd ? "" : port}`;

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-12">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-800">
            ← Панель
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-neutral-900">
            Мої сайти <span className="text-neutral-400">({sites.length})</span>
          </h1>
        </div>
        <Link
          href="/new"
          className="shrink-0 rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700"
        >
          Створити сайт
        </Link>
      </div>

      {sites.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 px-6 py-16 text-center text-neutral-500">
          Ще немає сайтів.{" "}
          <Link href="/new" className="font-medium text-neutral-800 underline">
            Створіть перший
          </Link>
          .
        </div>
      ) : (
        <ul className="space-y-3">
          {sites.map((s) => {
            const status = STATUS[s.status] ?? STATUS.demo;
            const name = s.brand?.businessName || s.host;
            return (
              <li
                key={s.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-neutral-200 bg-white px-5 py-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-lg font-semibold text-neutral-900">{name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.cls}`}>
                      {status.label}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate text-sm text-neutral-500">
                    {s.host} · {getVertical(s.vertical).label}
                  </div>
                </div>
                <a
                  href={urlFor(s.host!)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-800 transition hover:bg-neutral-100"
                >
                  Відкрити ↗
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
