import "server-only";
import { getServiceClient } from "@/lib/supabase/server";
import { generateSite } from "@/lib/ai/generate";
import type { FloristFacts } from "@/lib/verticals/florist";

/**
 * Generate a site from facts (Phase 2) and persist it as a tenant + home page in
 * Supabase. Shared by the dev endpoint and the onboarding finalize action.
 * Writes draft always; also published when `publish` (the visitor sees it).
 */
export interface PublishResult {
  host: string;
  themePresetId: string;
  composition: string[];
}

export async function generateAndPublish(
  facts: FloristFacts,
  host: string,
  publish = true,
): Promise<PublishResult> {
  const site = await generateSite(facts);
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

  if (tErr || !tenant) throw new Error(`tenant upsert failed: ${tErr?.message ?? "no row"}`);

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

  if (pErr) throw new Error(`page upsert failed: ${pErr.message}`);

  return { host, themePresetId: site.themePresetId, composition: site.blocks.map((b) => b.type) };
}
