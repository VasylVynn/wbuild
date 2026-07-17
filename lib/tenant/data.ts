import type { Tenant, Page, NavItem, PageSeo } from "./types";
import type { Theme } from "@/lib/theme/tokens";
import type { StoredBlock } from "@/lib/blocks/schema";
import { seedTenants, seedPages } from "./seed";
import { isSupabaseConfigured, getServiceClient } from "@/lib/supabase/server";

/**
 * Read layer. Reads from Supabase when configured, else from the in-memory
 * seed (keeps the app running with no keys — incremental bring-up). Public
 * render reads PUBLISHED content only (brief §5.5): the resolved view exposes
 * `published_theme` / `published_content` as `theme` / `blocks`.
 */

// ── DB row shapes (untyped `select('*')` → cast) ──────────────────────────
interface TenantRow {
  id: string;
  host: string | null;
  canonical_hostname: string | null;
  nav_mode: "onepage" | "multipage";
  status: Tenant["status"];
  brand: Tenant["brand"];
  footer: Tenant["footer"];
  facts: Record<string, unknown>;
  draft_theme: Theme;
  published_theme: Theme | null;
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
  draft_content: { blocks: StoredBlock[]; pocket?: StoredBlock[]; seo?: PageSeo };
  published_content: { blocks: StoredBlock[]; seo?: PageSeo } | null;
  is_published: boolean;
}

function mapTenant(row: TenantRow): Tenant {
  return {
    id: row.id,
    host: row.host ?? "",
    canonicalHostname: row.canonical_hostname ?? row.host ?? "",
    navMode: row.nav_mode,
    status: row.status,
    brand: row.brand,
    footer: row.footer ?? {},
    theme: row.published_theme ?? row.draft_theme, // public view = published
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
  };
}

// ── public API ────────────────────────────────────────────────────────────
export async function getTenantByHost(host: string): Promise<Tenant | null> {
  if (!isSupabaseConfigured()) {
    return seedTenants.find((t) => t.host === host) ?? null;
  }
  const sb = getServiceClient();
  const { data, error } = await sb.from("tenants").select("*").eq("host", host).maybeSingle();
  if (error || !data) return null;
  // Kill-switch (§11): a suspended tenant must NOT serve publicly. (Cached
  // pages also need a purge on suspend — see revalidateTenant.)
  if ((data as TenantRow).status === "suspended") return null;
  return mapTenant(data as TenantRow);
}

export async function getPublishedPage(host: string, slug: string): Promise<Page | null> {
  if (!isSupabaseConfigured()) {
    const tenant = seedTenants.find((t) => t.host === host);
    if (!tenant) return null;
    return (
      seedPages.find((p) => p.tenantId === tenant.id && p.slug === slug && p.isPublished) ?? null
    );
  }
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
  if (!isSupabaseConfigured()) {
    const tenant = seedTenants.find((t) => t.host === host);
    if (!tenant) return [];
    return seedPages
      .filter((p) => p.tenantId === tenant.id && p.isPublished)
      .sort((a, b) => a.navOrder - b.navOrder);
  }
  const tenant = await getTenantByHost(host);
  if (!tenant) return [];
  const { data, error } = await sb_pages()
    .eq("tenant_id", tenant.id)
    .eq("is_published", true)
    .order("nav_order", { ascending: true });
  if (error || !data) return [];
  return (data as PageRow[]).map(mapPage);
}

/** Nav is a PROJECTION of the data, never hand-edited (§5.3). */
export async function getNav(host: string): Promise<NavItem[]> {
  const tenant = await getTenantByHost(host);
  if (!tenant) return [];

  if (tenant.navMode === "onepage") {
    const home = await getPublishedPage(host, "");
    if (!home) return [];
    // C3: a repeated block type (services ×2) must contribute ONE nav entry —
    // the first instance's anchor wins (template path dedups the same way in
    // buildTemplateBrand). Identity is the anchor BASE (#services-2 → #services),
    // not the label: two distinct blocks sharing a label must both survive.
    const seenAnchors = new Set<string>();
    return home.blocks
      .filter((b) => !b.hidden && b.showInNav && b.anchor)
      .map((b) => ({ label: b.navLabel ?? b.anchor!.replace(/^#/, ""), href: b.anchor! }))
      .filter((item) => {
        const key = item.href.replace(/-\d+$/, "");
        if (seenAnchors.has(key)) return false;
        seenAnchors.add(key);
        return true;
      });
  }

  const pages = await getPublishedPages(host);
  return pages
    .filter((p) => p.showInNav && p.slug !== "")
    .map((p) => ({ label: p.title, href: `/${p.slug}` }));
}

// Small helper so the pages query builder is written once.
function sb_pages() {
  return getServiceClient().from("pages").select("*");
}
