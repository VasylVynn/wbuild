import type { Tenant, Page, PageSeo } from "./types";
import type { StoredBlock } from "@/lib/blocks/schema";
import type { DesignSpec } from "@/lib/site/design-spec";
import { isSupabaseConfigured, getServiceClient } from "@/lib/supabase/server";

/**
 * Read layer. Public render reads PUBLISHED content only (brief §5.5) — the
 * draft half of a page never reaches a visitor. With no Supabase keys there is
 * nothing to read: a tenant is a DB row, so every lookup returns empty rather
 * than a fixture, and the host 404s.
 */

// ── DB row shapes (untyped `select('*')` → cast) ──────────────────────────
interface TenantRow {
  id: string;
  host: string | null;
  custom_domain: string | null;
  canonical_hostname: string | null;
  status: Tenant["status"];
  brand: Tenant["brand"];
  footer: Tenant["footer"];
  facts: Record<string, unknown>;
  vertical: string;
}
interface PageRow {
  id: string;
  tenant_id: string;
  slug: string;
  page_type: string;
  title: string;
  show_in_nav: boolean;
  nav_order: number;
  draft_content: { blocks: StoredBlock[]; pocket?: StoredBlock[]; seo?: PageSeo; templateId?: string; wireCss?: string; designSpec?: DesignSpec };
  published_content: { blocks: StoredBlock[]; seo?: PageSeo; templateId?: string; wireCss?: string; designSpec?: DesignSpec } | null;
  is_published: boolean;
}

function mapTenant(row: TenantRow): Tenant {
  return {
    id: row.id,
    host: row.host ?? "",
    canonicalHostname: row.canonical_hostname ?? row.host ?? "",
    status: row.status,
    brand: row.brand,
    footer: row.footer ?? {},
    facts: row.facts ?? {},
  };
}

function mapPage(row: PageRow): Page {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    slug: row.slug,
    pageType: row.page_type,
    title: row.title,
    isPublished: row.is_published,
    showInNav: row.show_in_nav,
    navOrder: row.nav_order,
    blocks: (row.published_content ?? { blocks: [] }).blocks ?? [],
    seo: row.published_content?.seo,
    // The design travels WITH the content it was generated for (2026-07-27).
    // Both used to live on the unversioned `brand`, which meant regenerating a
    // draft instantly changed the LIVE site — a draft-only action must never do
    // that (invariant 6). Same split `seo` already uses.
    templateId: row.published_content?.templateId,
    wireCss: row.published_content?.wireCss,
    designSpec: row.published_content?.designSpec,
  };
}

// ── public API ────────────────────────────────────────────────────────────
export async function getTenantByHost(host: string): Promise<Tenant | null> {
  if (!isSupabaseConfigured()) return null;
  const sb = getServiceClient();
  const { data, error } = await sb.from("tenants").select("*").eq("host", host).maybeSingle();

  // A tenant answers on its subdomain AND, once ops activates one, on its own
  // domain (spec 2026-08-05 §4). The subdomain is by far the common case, so the
  // custom-domain query only runs on a miss — the hot render path keeps its
  // single round trip. canonical_hostname (invariant 2) is what activation
  // rewrites, so absolute URLs follow the domain, not the request host.
  let row = error ? null : (data as TenantRow | null);
  if (!row) {
    const { data: byDomain } = await sb
      .from("tenants")
      .select("*")
      .eq("custom_domain", host)
      .maybeSingle();
    row = (byDomain as TenantRow | null) ?? null;
  }
  if (!row) return null;

  // Kill-switch (§11): a suspended tenant must NOT serve publicly. (Cached
  // pages also need a purge on suspend — see revalidateTenant.)
  if (row.status === "suspended") return null;
  return mapTenant(row);
}

export async function getPublishedPage(host: string, slug: string): Promise<Page | null> {
  if (!isSupabaseConfigured()) return null;
  const tenant = await getTenantByHost(host);
  if (!tenant) return null;
  const { data, error } = await sb_pages()
    .eq("tenant_id", tenant.id)
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (error || !data) return null;
  return mapPage(data as PageRow);
}

export async function getPublishedPages(host: string): Promise<Page[]> {
  if (!isSupabaseConfigured()) return [];
  const tenant = await getTenantByHost(host);
  if (!tenant) return [];
  const { data, error } = await sb_pages()
    .eq("tenant_id", tenant.id)
    .eq("is_published", true)
    .order("nav_order", { ascending: true });
  if (error || !data) return [];
  return (data as PageRow[]).map(mapPage);
}

// Small helper so the pages query builder is written once.
function sb_pages() {
  return getServiceClient().from("pages").select("*");
}
