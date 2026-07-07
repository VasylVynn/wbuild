import { NextResponse } from "next/server";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { seedTenants, seedPages } from "@/lib/tenant/seed";

/**
 * DEV-ONLY seeder: upserts the in-memory seed (florist tenant + home page) into
 * Supabase so the DB-backed render has data. Idempotent (upsert on host /
 * tenant_id+slug). Disabled in production. Trigger: `curl -X POST .../api/dev/seed`.
 */
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "disabled in production" }, { status: 403 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 400 });
  }

  const sb = getServiceClient();
  const results: unknown[] = [];

  for (const t of seedTenants) {
    const { data: tenant, error: tErr } = await sb
      .from("tenants")
      .upsert(
        {
          host: t.host,
          canonical_hostname: t.canonicalHostname,
          nav_mode: t.navMode,
          status: t.status,
          brand: t.brand,
          footer: t.footer,
          facts: t.facts,
          draft_theme: t.theme,
          published_theme: t.theme,
          vertical: "florist",
        },
        { onConflict: "host" },
      )
      .select()
      .single();

    if (tErr || !tenant) {
      results.push({ host: t.host, error: tErr?.message ?? "no row" });
      continue;
    }

    const pages = seedPages.filter((p) => p.tenantId === t.id);
    for (const p of pages) {
      const { error: pErr } = await sb.from("pages").upsert(
        {
          tenant_id: tenant.id,
          slug: p.slug,
          page_type: p.pageType,
          title: p.title,
          show_in_nav: p.showInNav,
          nav_order: p.navOrder,
          draft_content: { blocks: p.blocks, pocket: [] },
          published_content: { blocks: p.blocks },
          is_published: p.isPublished,
        },
        { onConflict: "tenant_id,slug" },
      );
      if (pErr) results.push({ page: `${t.host}/${p.slug}`, error: pErr.message });
    }
    results.push({ host: t.host, tenantId: tenant.id, pages: pages.length });
  }

  return NextResponse.json({ ok: true, results });
}
