import "server-only";
import { getServiceClient } from "@/lib/supabase/server";
import { revalidateTenant } from "@/lib/cache";
import { generateSite } from "@/lib/ai/generate";
import { generateHeroImage } from "@/lib/media/generate-image";
import { getVertical } from "@/lib/verticals/registry";
import type { BusinessFacts } from "@/lib/verticals/schema";
import type { SiteMedia } from "@/lib/media/media";

/**
 * Generate a site from facts for a vertical (Phase 2) and persist it as a
 * tenant + home page in Supabase. Shared by the dev endpoint and onboarding
 * finalize. Purges the tenant cache on publish (§5.5/§9.1).
 */
export interface PublishResult {
  host: string;
  themePresetId: string;
  verticalId: string;
  composition: string[];
}

export async function generateAndPublish(
  facts: BusinessFacts,
  host: string,
  verticalId?: string,
  publish = true,
  media?: SiteMedia,
): Promise<PublishResult> {
  const vertical = getVertical(verticalId);

  const site = await generateSite(facts, vertical.id, media);

  // No owner photos → generate ONE atmospheric hero background (§4.8). Runs
  // AFTER site generation so the prompt gets the model's business-specific
  // subject AND the chosen theme palette (a mismatched image is worse than
  // none). Fail-open: null on any error, and a site with no image is fine.
  if (!media?.photos?.length && !media?.generatedHero) {
    const gen = await generateHeroImage({
      verticalId: vertical.id,
      subject: site.imageSubject,
      palette: { primary: site.theme.colors.primary, background: site.theme.colors.background },
    });
    if (gen) {
      media = { ...(media ?? { photos: [] }), generatedHero: gen };
      // generateSite already ran → patch the hero block directly (same value
      // groundImages would have assigned had the URL existed earlier).
      const hero = site.blocks.find((b) => b.type === "hero");
      if (hero) (hero.props as { imageUrl?: string }).imageUrl = gen;
    }
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
        brand: {
          businessName: facts.businessName,
          packId: site.packId,
          ...(media?.logoUrl && { logoUrl: media.logoUrl }),
          ...(media?.photos?.length && { photos: media.photos }),
          ...(media?.generatedHero && { generatedHero: media.generatedHero }),
        },
        footer: {
          phone: facts.phone,
          address: facts.address,
          hours: facts.hours,
          copyright: `© ${facts.businessName}`,
        },
        facts,
        draft_theme: site.theme,
        published_theme: publish ? site.theme : null,
        vertical: vertical.id,
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

  if (publish) await revalidateTenant(host); // §5.5 / §9.1 purge-on-publish

  return {
    host,
    themePresetId: site.themePresetId,
    verticalId: vertical.id,
    composition: site.blocks.map((b) => b.type),
  };
}
