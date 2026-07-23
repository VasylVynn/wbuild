import "server-only";
import { after } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { revalidateTenant } from "@/lib/cache";
import { publicSiteUrl } from "@/lib/config";
import { generateSite } from "@/lib/ai/generate";
import { generateSiteImages, isImageGenConfigured } from "@/lib/media/generate-image";
import { adaptLogoForTemplate } from "@/lib/media/logo-adapt";
import { getVertical } from "@/lib/verticals/registry";
import type { BusinessFacts } from "@/lib/verticals/schema";
import type { SiteMedia } from "@/lib/media/media";
import { buildDossier, type Dossier } from "@/lib/dossier";
import { runDraftQualityLoop } from "@/lib/site/inspect";
import { designDnaSchema, dnaSeed, mulberry32, pick } from "@/lib/theme/dna";
import { getTemplate } from "@/lib/templates/registry";
import { rollBundleDna } from "@/lib/theme/dna-roll";
import { logoPaletteFamily } from "@/lib/theme/logo-palette";
import type { StoredBlock } from "@/lib/blocks/schema";
import type { PageSeo } from "@/lib/tenant/types";

/**
 * Composition axis (DNA-2): a seeded permutation of the MIDDLE blocks. Hero
 * stays first, the lead_form/contacts tail stays put, and services blocks
 * keep their slots (commercial story arc) — the other middles permute among
 * their own positions, so re-rolls change the page rhythm, not its logic.
 */
/**
 * Seeded layout-variant per template section (composition axis, DNA-2c).
 * C1-parity rules (review): hidden blocks neither juggle nor consume the
 * pool; when a section's pool is exhausted (more instances than variants)
 * the block keeps whatever it has instead of collapsing repeats to default.
 */
export function juggleTemplateVariants(
  blocks: StoredBlock[],
  tpl: { sections: Record<string, { variants?: Record<string, unknown> } | undefined> },
  rng: () => number,
): StoredBlock[] {
  const used = new Map<string, Set<string>>();
  return blocks.map((b) => {
    if (b.hidden) return b;
    const sec = b.section;
    const variants = sec ? Object.keys(tpl.sections[sec]?.variants ?? {}) : [];
    if (!sec || variants.length === 0) return b;
    const usedSet = used.get(sec) ?? new Set<string>();
    used.set(sec, usedSet);
    const options = ["", ...variants].filter((v) => !usedSet.has(v));
    if (!options.length) return b;
    const v = options[Math.floor(rng() * options.length)];
    usedSet.add(v);
    return { ...b, variant: v || undefined };
  });
}

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
 * DRAFT/PUBLISH split (refactor 04 §4): generation lands in the DRAFT only —
 * the owner confirms a real preview, then publishDraft() promotes it. The old
 * generateAndPublish() is gone; admin/dev shortcuts call the two in sequence.
 */

/** Generated gallery size for photo-less sites (hero comes on top of these). */
const GENERATED_GALLERY_COUNT = 4;

export async function generateDraft(opts: {
  host: string;
  facts: BusinessFacts;
  verticalId: string;
  media?: SiteMedia;
  templateId?: string;
  // The rich per-business context (03 §1.5). Absent → a bare facts+media
  // dossier is built here, so plain callers (admin fixtures, dev smokes) keep
  // working with deterministic fallbacks and no IG data.
  dossier?: Dossier;
}): Promise<{ ok: boolean; host: string; error?: string }> {
  const { host, facts, verticalId, templateId } = opts;
  let media = opts.media;
  // Per-generation token (03 §2.4 background images): stamped into
  // draft_content and carried by the deferred image job. A stale job whose
  // token no longer matches the stored content SKIPS it — so a failed job from
  // an earlier «Згенерувати ще раз» can never erase a newer generation's
  // pending gallery (codex review).
  const genToken = crypto.randomUUID();
  try {
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
    // DNA-3: the logo's dominant color nudges the bundle family (snap to
    // curated presets, never raw hex). Fail-open null keeps the plain roll.
    const logoFamily = await logoPaletteFamily(media?.logoUrl);
    const { dna } = rollBundleDna({
      tenantId: host,
      nonce: previous ? previous.designNonce + 1 : 0,
      verticalId: vertical.id,
      photosCount: media?.photos?.length ?? 0,
      previous,
      logoFamily,
    });
    const rng = mulberry32(dnaSeed(host, dna.designNonce));

    // Background image generation (owner decision: «сайт має бути гарний і без
    // фото»): with zero owner photos the site ships IMMEDIATELY — hero text-only,
    // gallery with shimmer placeholders — and the images arrive via after()
    // below, patched into the draft AND the published copy if already live.
    // Gated on an image-gen key: without it the placeholders would never
    // resolve, so we skip the shimmer path entirely (site renders text-only).
    const needGeneratedImages =
      !media?.photos?.length && !media?.generatedHero && isImageGenConfigured();
    if (needGeneratedImages) {
      media = { ...(media ?? { photos: [] }), generatedPending: GENERATED_GALLERY_COUNT };
    }

    const dossier = opts.dossier ?? buildDossier({ facts, media: media ?? null });
    const site = await generateSite(dossier, vertical.id, media, templateId, rng);

    // Template sites (DNA-2c): the composition axis — every section with
    // layout variants gets a SEEDED variant (repeats never share one, wave-C
    // rule) and the non-pinned middles get a seeded permutation. The model's
    // «best» variant converges to a constant for the same data — the seed is
    // what makes re-generation differ. (The classic/pack branch left with the
    // design-pack path: template resolution always succeeds now.)
    const tpl = getTemplate(site.templateId);
    if (tpl) {
      site.blocks = juggleTemplateVariants(site.blocks, tpl, rng);
      site.blocks = shuffleMiddles(site.blocks, rng);
    }
    // DNA-2c: templates with >1 data-theme start on a seeded one (visitor
    // toggle still wins later); ≠ previous when the pool allows.
    const tplThemes = tpl?.themes ?? [];
    // First DNA-2c roll on an old site: the visible theme is the template
    // default — exclude it too, so the axis genuinely participates (review).
    const prevTplTheme = previous?.templateTheme ?? tpl?.defaultTheme;
    const themePool = prevTplTheme ? tplThemes.filter((th) => th !== prevTplTheme) : tplThemes;
    const templateTheme =
      tplThemes.length > 1 ? (pick(rng, themePool.length ? themePool : tplThemes) ?? tplThemes[0]) : undefined;
    // Template sites (DNA-2b): the pair comes from the TEMPLATE's identity
    // allowlist, not the bundle — seeded, different from the previous roll.
    // A template without an allowlist gets no override (renders as authored).
    const tplPairs = tpl?.dnaFontPairs ?? [];
    // Repeat-avoidance falls back to the top-level fontPairId when stored DNA
    // didn't parse (partially migrated themes — review).
    const prevPairId =
      previous?.fontPairId ??
      (prevRow?.draft_theme as { fontPairId?: string } | null)?.fontPairId;
    const tplPairPool = prevPairId ? tplPairs.filter((id) => id !== prevPairId) : tplPairs;
    const tplPair = tplPairs.length
      ? (pick(rng, tplPairPool.length ? tplPairPool : tplPairs) ?? tplPairs[0])
      : undefined;
    const themeWithDna = {
      ...site.theme,
      ...(tplPair && { fontPairId: tplPair }),
      dna: {
        ...dna,
        presetId: site.themePresetId ?? dna.presetId,
        // "" = honestly no pair (template without an allowlist) — never the
        // bundle's pair that this render ignores (review).
        fontPairId: tplPair ?? "",
        ...(templateTheme && { templateTheme }),
      },
    };

    const sb = getServiceClient();

    // DRAFT-scope upsert: published_theme is intentionally OMITTED — untouched
    // on an existing tenant, NULL (column default) on a new one. Status drops
    // to "draft" until publishDraft() promotes it.
    const { data: tenant, error: tErr } = await sb
      .from("tenants")
      .upsert(
        {
          host,
          canonical_hostname: host,
          nav_mode: "onepage",
          status: "draft",
          brand: {
            businessName: facts.businessName,
            templateId: site.templateId,
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
          draft_theme: themeWithDna,
          vertical: vertical.id,
        },
        { onConflict: "host" },
      )
      .select()
      .single();

    if (tErr || !tenant) throw new Error(`tenant upsert failed: ${tErr?.message ?? "no row"}`);

    // H1 logo adaptation stays OFF the critical path (live 504: generation
    // retry + vision gate + gemini pushed finalize past its time budget).
    // after() runs post-response: adapt → re-read brand fresh (lost-update
    // lesson) → patch → purge. Fail-open: no adaptation, original renders.
    if (media?.logoUrl && site.templateId) {
      const logoUrl = media.logoUrl;
      const tplForLogo = site.templateId;
      const tenantId = tenant.id as string;
      after(async () => {
        try {
          const adapted = await adaptLogoForTemplate({ logoUrl, templateId: tplForLogo });
          if (!adapted) return;
          const { data: t2 } = await sb.from("tenants").select("brand").eq("id", tenantId).maybeSingle();
          const brand2 = { ...((t2?.brand ?? {}) as Record<string, unknown>), logoAdaptedUrl: adapted };
          await sb.from("tenants").update({ brand: brand2 }).eq("id", tenantId);
          await revalidateTenant(host);
        } catch (e) {
          console.warn(`[publish] deferred logo adapt failed: ${e instanceof Error ? e.message : e}`);
        }
      });
    }

    // DRAFT-scope upsert: published_content / is_published are OMITTED — a
    // regenerate never nulls the live content; a new page starts unpublished
    // (column default). Draft-only writes never purge the cache (§5.5).
    const { error: pErr } = await sb.from("pages").upsert(
      {
        tenant_id: tenant.id,
        slug: "",
        page_type: "home",
        title: "Головна",
        show_in_nav: false,
        nav_order: 0,
        draft_content: { blocks: site.blocks, pocket: [], genToken, ...(site.seo && { seo: site.seo }) },
      },
      { onConflict: "tenant_id,slug" },
    );

    if (pErr) throw new Error(`page upsert failed: ${pErr.message}`);

    // Self-validation cycle (04 §4): inspect the draft against the dossier,
    // fix/drop offending sections, ≤2 rounds. Operates on the just-saved
    // draft; fail-open inside (a broken inspector must never kill generation).
    await runDraftQualityLoop({ host, facts, verticalId: vertical.id, media, templateId: site.templateId, dossier });

    // Background image batch — runs post-response, AFTER the quality loop's
    // final draft save (no write race). Patches the shimmer placeholders with
    // real generated images; reaches the published copy too if the owner has
    // already hit «Опублікувати» by then.
    if (needGeneratedImages) {
      const subject = site.imageSubject;
      const palette = {
        primary: themeWithDna.colors.primary,
        background: themeWithDna.colors.background,
      };
      const verticalIdForGen = vertical.id;
      const altBase = facts.city ? `${facts.businessName}, ${facts.city}` : facts.businessName;
      after(async () => {
        let hero: string | null = null;
        let gallery: string[] = [];
        try {
          const gen = await generateSiteImages({
            verticalId: verticalIdForGen,
            subject,
            palette,
            galleryCount: GENERATED_GALLERY_COUNT,
          });
          hero = gen.hero;
          gallery = gen.gallery;
        } catch (e) {
          console.warn(`[publish] deferred image gen failed: ${e instanceof Error ? e.message : e}`);
        }
        // ALWAYS patch — even on total failure (hero=null, gallery=[]). The
        // pending gallery MUST be resolved: real images when we have them, an
        // empty (self-hiding) gallery otherwise. Skipping this would strand the
        // shimmer placeholders in stored draft_content forever (codex review).
        // genToken scopes the patch to THIS generation — a stale job whose
        // token no longer matches the stored content leaves it untouched.
        try {
          await patchGeneratedImages({ host, hero, gallery, altBase, genToken });
        } catch (e) {
          console.warn(`[publish] deferred image patch failed: ${e instanceof Error ? e.message : e}`);
        }
      });
    }

    return { ok: true, host };
  } catch (e) {
    return { ok: false, host, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Deferred-image patch: swap the shimmer placeholders for the generated URLs
 * in the DRAFT — and in the PUBLISHED copy too when the owner already
 * published (then purge). Re-reads fresh rows (lost-update lesson from the
 * logo-adapt job); every failure is a warn, never a throw.
 */
async function patchGeneratedImages(opts: {
  host: string;
  hero: string | null;
  gallery: string[];
  altBase: string;
  /** The generation this job belongs to — patch content only while it still
   *  carries this token (a newer «Згенерувати ще раз» replaces it). */
  genToken: string;
}): Promise<void> {
  const { host, hero, gallery, altBase, genToken } = opts;
  const sb = getServiceClient();
  const { data: tenant } = await sb
    .from("tenants")
    .select("id")
    .eq("host", host)
    .maybeSingle();
  if (!tenant) return;

  const patchBlocks = (blocks: StoredBlock[]): StoredBlock[] =>
    blocks.map((b) => {
      if (b.type === "hero" && hero && !b.props.imageUrl) {
        return {
          ...b,
          props: { ...b.props, imageUrl: hero, imageAlt: `Атмосферне зображення — ${altBase}` },
        };
      }
      if (b.type === "gallery" && (b.props.pendingImages ?? 0) > 0 && gallery.length >= 2) {
        return {
          ...b,
          props: {
            title: b.props.title,
            images: gallery.map((url, i) => ({
              url,
              alt: `Атмосферне зображення ${i + 1} — ${altBase}`,
            })),
          },
        };
      }
      if (b.type === "gallery" && (b.props.pendingImages ?? 0) > 0) {
        // <2 images came back → an empty gallery must not stay: drop the
        // placeholders (renderers hide an empty gallery) rather than show one
        // lonely tile forever.
        return { ...b, props: { title: b.props.title, images: b.props.images } };
      }
      return b;
    });

  const { data: page } = await sb
    .from("pages")
    .select("id, draft_content, published_content, is_published")
    .eq("tenant_id", tenant.id)
    .eq("slug", "")
    .maybeSingle();
  if (!page) return;

  const draft = (page.draft_content ?? {}) as {
    blocks?: StoredBlock[];
    genToken?: string;
  } & Record<string, unknown>;
  const pub = (page.published_content ?? null) as
    | ({ blocks?: StoredBlock[]; genToken?: string } & Record<string, unknown>)
    | null;

  // ATOMIC compare-and-swap on the token (codex review): the read above is
  // stale by the time we write, so the token filter lives in the UPDATE's WHERE
  // — Postgres re-checks it at write time in a single statement. If a newer
  // «Згенерувати ще раз» replaced the content's token between our read and
  // write, zero rows match and we clobber nothing. `.select()` returns the rows
  // actually written, so we know whether this job owned the content.
  let ownedAnything = false;

  // The generated hero URL is stored INSIDE draft_content (not brand) so it
  // rides the SAME atomic CAS write as the blocks — no separate brand
  // read-modify-write to race (codex review). Editor regeneration reads it from
  // draft_content (edit/actions.ts). generatedGallery is dropped: nothing read
  // it, and the images already live in the gallery block.
  if (Array.isArray(draft.blocks) && draft.genToken === genToken) {
    const next = { ...draft, blocks: patchBlocks(draft.blocks), ...(hero && { generatedHero: hero }) };
    const { data: rows, error } = await sb
      .from("pages")
      .update({ draft_content: next })
      .eq("id", page.id)
      .eq("draft_content->>genToken", genToken)
      .select("id");
    if (error) {
      console.warn(`[publish] draft image patch failed: ${error.message}`);
    } else if (rows?.length) {
      ownedAnything = true;
    }
  }

  let patchedPublished = false;
  if (page.is_published && pub && Array.isArray(pub.blocks) && pub.genToken === genToken) {
    const next = { ...pub, blocks: patchBlocks(pub.blocks), ...(hero && { generatedHero: hero }) };
    const { data: rows, error } = await sb
      .from("pages")
      .update({ published_content: next })
      .eq("id", page.id)
      .eq("published_content->>genToken", genToken)
      .select("id");
    if (error) {
      console.warn(`[publish] published image patch failed: ${error.message}`);
    } else if (rows?.length) {
      ownedAnything = true;
      patchedPublished = true;
    }
  }

  // Nothing this job owned (a newer generation won the race) → nothing to purge.
  if (!ownedAnything) return;

  // Purge only when the LIVE copy actually changed (a draft-only patch never
  // affects what visitors see, §5.5).
  if (patchedPublished) await revalidateTenant(host);
}

/**
 * Promote the draft to the live site: draft_theme → published_theme,
 * draft_content → published_content, status "published", purge the tenant
 * cache (§5.5/§9.1). The ONLY path that publishes — human- (or admin-)
 * triggered, never called by an agent loop (invariant 6).
 */
export async function publishDraft(host: string): Promise<{ ok: boolean; url: string; error?: string }> {
  const url = publicSiteUrl(host);
  try {
    const sb = getServiceClient();
    const { data: tenant, error: tErr } = await sb
      .from("tenants")
      .select("id, draft_theme")
      .eq("host", host)
      .maybeSingle();
    if (tErr || !tenant) throw new Error(`tenant read failed: ${tErr?.message ?? "not found"}`);

    const { data: page, error: pReadErr } = await sb
      .from("pages")
      .select("id, draft_content")
      .eq("tenant_id", tenant.id)
      .eq("slug", "")
      .maybeSingle();
    if (pReadErr || !page) throw new Error(`page read failed: ${pReadErr?.message ?? "not found"}`);

    const draft = (page.draft_content ?? {}) as {
      blocks?: StoredBlock[];
      seo?: PageSeo;
      genToken?: string;
      generatedHero?: string;
    };
    if (!draft.blocks?.length) throw new Error("draft is empty — generate before publishing");

    const { error: tUpdErr } = await sb
      .from("tenants")
      .update({ status: "published", published_theme: tenant.draft_theme })
      .eq("id", tenant.id);
    if (tUpdErr) throw new Error(`tenant publish failed: ${tUpdErr.message}`);

    // published_content carries blocks + seo, never the pocket (editor-only).
    // genToken rides along so a still-running image job can patch the published
    // copy too (it was generated for THIS token).
    const { error: pUpdErr } = await sb
      .from("pages")
      .update({
        published_content: {
          blocks: draft.blocks,
          ...(draft.genToken && { genToken: draft.genToken }),
          ...(draft.generatedHero && { generatedHero: draft.generatedHero }),
          ...(draft.seo && { seo: draft.seo }),
        },
        is_published: true,
      })
      .eq("id", page.id);
    if (pUpdErr) throw new Error(`page publish failed: ${pUpdErr.message}`);

    await revalidateTenant(host); // §5.5 / §9.1 purge-on-publish
    return { ok: true, url };
  } catch (e) {
    return { ok: false, url, error: e instanceof Error ? e.message : String(e) };
  }
}
