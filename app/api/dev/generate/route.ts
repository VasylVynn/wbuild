import { NextResponse } from "next/server";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { isAnthropicConfigured } from "@/lib/ai/anthropic";
import { generateSite } from "@/lib/ai/generate";
import { seedTenants } from "@/lib/tenant/seed";
import type { FloristFacts } from "@/lib/verticals/florist";

/**
 * DEV-ONLY: run the Phase 2 generation pipeline end to end.
 *   POST /api/dev/generate  { facts?, host?, publish? }
 * Generates a florist site from facts (defaults to the seed florist's facts),
 * writes it as a tenant + home page in Supabase (draft, and published when
 * publish=true), and returns a summary so you can open host.lvh.me:3000.
 */
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "disabled in production" }, { status: 403 });
  }
  if (!isAnthropicConfigured()) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 400 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    facts?: FloristFacts;
    host?: string;
    publish?: boolean;
  };

  const facts = (body.facts ?? (seedTenants[0].facts as unknown as FloristFacts)) as FloristFacts;
  const host = body.host ?? "test.lvh.me";
  const publish = body.publish ?? true;

  let site;
  try {
    site = await generateSite(facts);
  } catch (e) {
    return NextResponse.json(
      { error: "generation failed", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }

  const sb = getServiceClient();

  const { data: tenant, error: tErr } = await sb
    .from("tenants")
    .upsert(
      {
        host,
        canonical_hostname: host,
        nav_mode: "onepage",
        status: publish ? "published" : "draft",
        brand: { businessName: facts.businessName },
        footer: {
          phone: facts.phone,
          address: facts.address,
          hours: facts.hours,
          copyright: `© ${facts.businessName}`,
        },
        facts,
        draft_theme: site.theme,
        published_theme: publish ? site.theme : null,
        vertical: "florist",
      },
      { onConflict: "host" },
    )
    .select()
    .single();

  if (tErr || !tenant) {
    return NextResponse.json({ error: "tenant upsert failed", detail: tErr?.message }, { status: 500 });
  }

  const { error: pErr } = await sb.from("pages").upsert(
    {
      tenant_id: tenant.id,
      slug: "",
      page_type: "home",
      title: "Головна",
      show_in_nav: false,
      nav_order: 0,
      draft_content: { blocks: site.blocks, pocket: [] },
      published_content: publish ? { blocks: site.blocks } : null,
      is_published: publish,
    },
    { onConflict: "tenant_id,slug" },
  );

  if (pErr) {
    return NextResponse.json({ error: "page upsert failed", detail: pErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    host,
    url: `http://${host}:3000`,
    themePresetId: site.themePresetId,
    blockCount: site.blocks.length,
    composition: site.blocks.map((b) => b.type),
  });
}
