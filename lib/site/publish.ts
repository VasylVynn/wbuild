import "server-only";
import { getServiceClient } from "@/lib/supabase/server";
import { revalidateTenant } from "@/lib/cache";
import { generateSite } from "@/lib/ai/generate";
import { generateHeroImage } from "@/lib/media/generate-image";
import { adaptLogoForTemplate } from "@/lib/media/logo-adapt";
import { getVertical } from "@/lib/verticals/registry";
import type { BusinessFacts } from "@/lib/verticals/schema";
import type { SiteMedia } from "@/lib/media/media";
import { designDnaSchema, dnaSeed, mulberry32, pick } from "@/lib/theme/dna";
import { getTemplate } from "@/lib/templates/registry";
import { rollBundleDna } from "@/lib/theme/dna-roll";
import { resolveTheme } from "@/lib/theme/presets";
import type { StoredBlock } from "@/lib/blocks/schema";

/**
 * Composition axis (DNA-2): a seeded permutation of the MIDDLE blocks. Hero
 * stays first, the lead_form/contacts tail stays put, and services blocks
 * keep their slots (commercial story arc) — the other middles permute among
 * their own positions, so re-rolls change the page rhythm, not its logic.
 */
export function shuffleMiddles(blocks: StoredBlock[], rng: () => number): StoredBlock[] {
  // Pin by TYPE, not by position (codex review): hero/funnel/services stay
  // wherever they are — robust to owner-reordered drafts and malformed
  // compositions; everything else permutes among its own slots.
  const PINNED = new Set(["hero", "lead_form", "contacts", "services"]);
  const slots: number[] = [];
  for (let i = 0; i < blocks.length; i++) if (!PINNED.has(blocks[i].type)) slots.push(i);
  if (slots.length < 2) return blocks;
  const perm = [...slots];
  for (let i = perm.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  const out = [...blocks];
  slots.forEach((pos, k) => {
    out[pos] = blocks[perm[k]];
  });
  return out;
}

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
  // B4: a design chosen in the onboarding chat — forwarded into generateSite's
  // existing force-slot (same mechanism regenerate uses to keep a template).
  templateId?: string,
): Promise<PublishResult> {
  const vertical = getVertical(verticalId);

  // Design-DNA (wave DNA-1). Seeded by HOST (stable and known BEFORE the
  // tenant upsert — tenant.id is not). A repeat generation for the same host
  // advances the nonce, so the drawn font pair (and, with bundles in DNA-2,
  // the whole look) shifts on every run — «same data ⇒ different site».
  const sbPre = getServiceClient();
  const { data: prevRow, error: prevErr } = await sbPre
    .from("tenants")
    .select("draft_theme")
    .eq("host", host)
    .maybeSingle();
  // A transient read failure must not masquerade as «new tenant» and reset
  // the nonce history (codex review) — fail loudly, the caller retries.
  if (prevErr) throw new Error(`tenant pre-read failed: ${prevErr.message}`);
  const prevDna = designDnaSchema.safeParse(
    (prevRow?.draft_theme as { dna?: unknown } | null)?.dna,
  );
  const previous = prevDna.success ? prevDna.data : null;
  // Bundle-aware roll (DNA-2): the bundle carries palette family, font pair,
  // hero archetype and the whole skin-set — «different bundle» = a different
  // SITE, not a recolor. The photo inventory picks the honest hero.
  const { dna } = rollBundleDna({
    tenantId: host,
    nonce: previous ? previous.designNonce + 1 : 0,
    verticalId: vertical.id,
    photosCount: media?.photos?.length ?? 0,
    previous,
  });
  const rng = mulberry32(dnaSeed(host, dna.designNonce));

  const site = await generateSite(facts, vertical.id, media, undefined, templateId, rng);

  // Classic (registry) path: the bundle REPLACES the pack's look — its preset
  // becomes the theme, its skin-set re-skins the blocks, middles get a seeded
  // permutation (composition axis; services keep their slots — load-bearing).
  // Template path: the template owns the look; DNA rides along as the pair +
  // motion record only (bundles reach templates in a later DNA-2 subwave).
  const isClassic = !site.templateId;
  if (isClassic) {
    if (dna.skinOverrides) {
      site.blocks = site.blocks.map((b) => {
        const o = dna.skinOverrides?.[b.type];
        return o === undefined ? b : { ...b, skin: o || undefined };
      });
    }
    site.blocks = shuffleMiddles(site.blocks, rng);
  }
  // Template sites (DNA-2b): the pair comes from the TEMPLATE's identity
  // allowlist, not the bundle — seeded, different from the previous roll.
  // A template without an allowlist gets no override (renders as authored).
  const tplPairs = getTemplate(site.templateId)?.dnaFontPairs ?? [];
  // Repeat-avoidance falls back to the top-level fontPairId when stored DNA
  // didn't parse (partially migrated themes — review).
  const prevPairId =
    previous?.fontPairId ??
    (prevRow?.draft_theme as { fontPairId?: string } | null)?.fontPairId;
  const tplPairPool = prevPairId ? tplPairs.filter((id) => id !== prevPairId) : tplPairs;
  const tplPair = tplPairs.length
    ? (pick(rng, tplPairPool.length ? tplPairPool : tplPairs) ?? tplPairs[0])
    : undefined;
  const themeWithDna = isClassic
    ? { ...resolveTheme(dna.presetId), fontPairId: dna.fontPairId, dna }
    : {
        ...site.theme,
        ...(tplPair && { fontPairId: tplPair }),
        dna: {
          ...dna,
          presetId: site.themePresetId ?? dna.presetId,
          // "" = honestly no pair (template without an allowlist) — never the
          // bundle's pair that this render ignores (review).
          fontPairId: tplPair ?? "",
        },
      };

  // No owner photos → generate ONE atmospheric hero background (§4.8). Runs
  // AFTER site generation so the prompt gets the model's business-specific
  // subject AND the chosen theme palette (a mismatched image is worse than
  // none). Fail-open: null on any error, and a site with no image is fine.
  // Skip the paid atmospheric image when the bundle chose a hero that ignores
  // imagery BY DESIGN (editorial) — a generated file nobody renders is waste.
  const heroIgnoresImage = isClassic && dna.skinOverrides?.hero === "editorial";
  if (!media?.photos?.length && !media?.generatedHero && !heroIgnoresImage) {
    const gen = await generateHeroImage({
      verticalId: vertical.id,
      subject: site.imageSubject,
      palette: {
        primary: themeWithDna.colors.primary,
        background: themeWithDna.colors.background,
      },
    });
    if (gen) {
      media = { ...(media ?? { photos: [] }), generatedHero: gen };
      // generateSite already ran → patch the hero block directly (same values
      // groundImages would have assigned had the URL existed earlier, alt
      // included — D3 keeps the two paths in lockstep).
      const hero = site.blocks.find((b) => b.type === "hero");
      if (hero) {
        const props = hero.props as { imageUrl?: string; imageAlt?: string };
        props.imageUrl = gen;
        props.imageAlt = `Атмосферне зображення — ${
          facts.city ? `${facts.businessName}, ${facts.city}` : facts.businessName
        }`;
      }
    }
  }

  // H1: owner has a logo + a template site → vision-check it against the
  // template's nav surface and adapt when it clashes. Fail-open: null keeps
  // the original only; the adapted variant sits ALONGSIDE it, never replaces.
  let logoAdaptedUrl: string | null = null;
  if (media?.logoUrl && site.templateId) {
    logoAdaptedUrl = await adaptLogoForTemplate({
      logoUrl: media.logoUrl,
      templateId: site.templateId,
    });
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
          // Exactly one design source is set: templateId (template site) or
          // packId (pack site). The render path reads brand.templateId.
          ...(site.packId && { packId: site.packId }),
          ...(site.templateId && { templateId: site.templateId }),
          ...(media?.logoUrl && { logoUrl: media.logoUrl }),
          ...(logoAdaptedUrl && { logoAdaptedUrl }),
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
        draft_theme: themeWithDna,
        published_theme: publish ? themeWithDna : null,
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
      draft_content: { blocks: site.blocks, pocket: [], ...(site.seo && { seo: site.seo }) },
      published_content: publish ? { blocks: site.blocks, ...(site.seo && { seo: site.seo }) } : null,
      is_published: publish,
    },
    { onConflict: "tenant_id,slug" },
  );

  if (pErr) throw new Error(`page upsert failed: ${pErr.message}`);

  if (publish) await revalidateTenant(host); // §5.5 / §9.1 purge-on-publish

  return {
    host,
    themePresetId: isClassic ? dna.presetId : site.themePresetId,
    verticalId: vertical.id,
    composition: site.blocks.map((b) => b.type),
  };
}
