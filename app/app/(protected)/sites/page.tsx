import Link from "next/link";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { myTenantIds } from "@/lib/tenant/membership";
import { getVertical } from "@/lib/verticals/registry";
import { ROOT_DOMAIN } from "@/lib/config";
import TelegramConnect from "@/components/dashboard/TelegramConnect";
import { Card, Chip, EmptyState } from "@/components/ui";

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
    .select("id, host, status, vertical, brand, created_at, telegram_chat_id")
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
const primaryLinkMd =
  "inline-flex shrink-0 min-h-12 items-center justify-center gap-2 rounded-[16px] bg-brand px-5 font-ui text-[16px] font-bold text-white transition-colors hover:bg-brand-hover";
const secondaryLinkMd =
  "inline-flex flex-1 min-h-12 items-center justify-center gap-2 rounded-[16px] border-[1.5px] border-line-strong bg-surface px-5 font-ui text-[16px] font-bold text-ink transition-colors hover:bg-sunken";

export default async function SitesPage() {
  const sites = await listSites();
  const isProd = process.env.NODE_ENV === "production";
  const port = ROOT_DOMAIN.includes(":") ? `:${ROOT_DOMAIN.split(":")[1]}` : "";
  const urlFor = (host: string) => `${isProd ? "https" : "http"}://${host}${isProd ? "" : port}`;

  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-canvas px-6 py-12">
      {/* Binds sites created anonymously before the user registered (§3.1). */}
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <Link href="/" className="text-[14px] font-bold text-ink-muted transition-colors hover:text-ink">
            ← Панель
          </Link>
          <h1 className="mt-1.5 font-brand text-[24px] font-medium text-ink">
            Мої сайти <span className="text-ink-faint">({sites.length})</span>
          </h1>
        </div>
        <Link href="/new" className={primaryLinkMd}>
          + Створити сайт
        </Link>
      </div>

      {sites.length === 0 ? (
        <EmptyState emoji="🌐" title="Ще немає сайтів">
          Створіть перший у простій розмові з помічником — це займе близько трьох хвилин.
          <div className="mt-4">
            <Link href="/new" className={`${primaryLinkMd} w-full sm:w-auto`}>
              Створити сайт
            </Link>
          </div>
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-3.5">
          {sites.map((s) => {
            const status = STATUS[s.status] ?? STATUS.demo;
            const name = s.brand?.businessName || s.host;
            return (
              <li key={s.id}>
                <Card className="flex flex-col gap-3.5 p-5">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="truncate text-[19px] font-extrabold text-ink">{name}</span>
                    <Chip tone={status.tone}>{status.label}</Chip>
                  </div>
                  <div className="truncate text-[15px] font-semibold text-ink-muted">
                    {s.host} · {getVertical(s.vertical).label}
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Link href={`/edit/${encodeURIComponent(s.host!)}`} className={secondaryLinkMd}>
                      Редагувати
                    </Link>
                    <a
                      href={urlFor(s.host!)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={secondaryLinkMd}
                    >
                      Відкрити ↗
                    </a>
                  </div>
                  <TelegramConnect tenantId={s.id} connected={!!s.telegram_chat_id} />
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
