import "server-only";
import { after } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { revalidateTenant } from "@/lib/cache";
import { publicSiteUrl } from "@/lib/config";
import { generateSite } from "@/lib/ai/generate";
import { generateSiteImages, isImageGenConfigured } from "@/lib/media/generate-image";
import { getVertical } from "@/lib/verticals/registry";
import type { BusinessFacts } from "@/lib/verticals/schema";
import type { SiteMedia } from "@/lib/media/media";
import { buildDossier, type Dossier } from "@/lib/dossier";
import { runDraftQualityLoop } from "@/lib/site/inspect";
import { designSeed, mulberry32 } from "@/lib/design/seed";
import { generateWireStyle } from "@/lib/design/wire-style";
import type { StoredBlock } from "@/lib/blocks/schema";
import { publishedFromDraft, type PageContent } from "@/lib/site/page-content";

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
  // The rich per-business context (03 §1.5). Absent → a bare facts+media
  // dossier is built here, so plain callers (admin fixtures, dev smokes) keep
  // working with deterministic fallbacks and no IG data.
  dossier?: Dossier;
}): Promise<{ ok: boolean; host: string; error?: string }> {
  const { host, facts, verticalId } = opts;
  let media = opts.media;
  // Per-generation token (03 §2.4 background images): stamped into
  // draft_content and carried by the deferred image job. A stale job whose
  // token no longer matches the stored content SKIPS it — so a failed job from
  // an earlier «Згенерувати ще раз» can never erase a newer generation's
  // pending gallery (codex review).
  const genToken = crypto.randomUUID();
  try {
    const vertical = getVertical(verticalId);

    // Generation nonce — the one thing code still rolls. It seeds the hue
    // anchor handed to stylesheet generation, so a repeat generation for the
    // same host starts from a different colour world.
    const sbPre = getServiceClient();
    const { data: prevRow, error: prevErr } = await sbPre
      .from("tenants")
      .select("id, brand")
      .eq("host", host)
      .maybeSingle();
    // A transient read failure must not masquerade as «new tenant» and reset
    // the nonce history (codex review) — fail loudly, the caller retries.
    if (prevErr) throw new Error(`tenant pre-read failed: ${prevErr.message}`);
    const prevNonce = (prevRow?.brand as { designNonce?: number } | null)?.designNonce;
    const designNonce = typeof prevNonce === "number" ? prevNonce + 1 : 0;
    // This upsert REPLACES draft_content, so a styling failure would wipe the
    // stylesheet a previous run stored for this host. Seed the fallback with it:
    // an old sheet against a new composition degrades gracefully (every section
    // styles through the same `wire-*` contract), a missing one renders grey.
    let prevWireCss: string | undefined;
    if (prevRow?.id) {
      const { data: prevPage, error: prevPageErr } = await sbPre
        .from("pages")
        .select("draft_content")
        .eq("tenant_id", prevRow.id as string)
        .eq("slug", "")
        .maybeSingle();
      // Same rule as the tenant pre-read above: a transient failure must not
      // masquerade as «this host has no stylesheet». Swallowing it would let a
      // later styling failure fall back to nothing and wipe the stored sheet —
      // the very loss this read exists to prevent. Generation is retryable;
      // silent data loss is not.
      if (prevPageErr) throw new Error(`page pre-read failed: ${prevPageErr.message}`);
      prevWireCss = (prevPage?.draft_content as { wireCss?: string } | null)?.wireCss;
    }

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
    // The model composes against the wireframe: it picks WHICH sections this
    // business needs, in WHAT order, and writes the copy. No template choice,
    // no seeded variant juggling, no section shuffle — the composition is the
    // model's, end to end.
    const site = await generateSite(dossier, vertical.id, media);

    // The model then writes this tenant's stylesheet for the composition it
    // just produced. Fail-open: if styling dies the draft still ships — grey,
    // but complete, editable and publishable.
    let wireCss: string | undefined = prevWireCss;
    const brief = [
      `${facts.businessName}, ${facts.city}.`,
      facts.about ?? "",
      facts.services?.length
        ? `Послуги: ${facts.services.map((s) => s.name).slice(0, 8).join(", ")}.`
        : "",
    ]
      .filter(Boolean)
      .join(" ");
    // Hue seeded off host+nonce: two businesses in one niche start from
    // different colour worlds, and «згенерувати ще раз» moves to another.
    // Without this the model returns its default palette for the niche —
    // measured in the spike, two grooming salons both landed in warm cream.
    const hue = Math.floor(mulberry32(designSeed(`${host}:hue`, designNonce))() * 360);
    try {
      wireCss = (await generateWireStyle(brief, { hue })).css;
    } catch (e) {
      console.error(
        `[generate] styling failed for ${host}: ${e instanceof Error ? e.message : e}`,
      );
    }

    const sb = getServiceClient();

    // DRAFT-scope upsert: nothing here reaches the live site. The design rides
    // draft_content and is promoted only by publishDraft(); status drops to
    // "draft" until then.
    const { data: tenant, error: tErr } = await sb
      .from("tenants")
      .upsert(
        {
          host,
          canonical_hostname: host,
          status: "draft",
          brand: {
            businessName: facts.businessName,
            // The seed counter for the hue anchor — a generation COUNTER, not
            // a design, so the unversioned `brand` is its right home. The
            // design itself (templateId + wireCss) rides draft_content, because
            // a draft-only regeneration must never change the live site
            // (invariant 6).
            designNonce,
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
          vertical: vertical.id,
        },
        { onConflict: "host" },
      )
      .select()
      .single();

    if (tErr || !tenant) throw new Error(`tenant upsert failed: ${tErr?.message ?? "no row"}`);


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
        draft_content: {
            blocks: site.blocks,
            pocket: [],
            genToken,
            // The design travels WITH the content it was generated for — see
            // lib/site/page-content.ts. `brand` is unversioned, so putting it
            // there would let a draft regeneration change the live site.
            templateId: site.templateId,
            ...(wireCss && { wireCss }),
            ...(site.seo && { seo: site.seo }),
          } satisfies PageContent,
      },
      { onConflict: "tenant_id,slug" },
    );

    if (pErr) throw new Error(`page upsert failed: ${pErr.message}`);

    // Self-validation cycle (04 §4): inspect the draft against the dossier,
    // fix/drop offending sections, ≤2 rounds. Operates on the just-saved
    // draft; fail-open inside (a broken inspector must never kill generation).
    await runDraftQualityLoop({
      host,
      facts,
      verticalId: vertical.id,
      media,
      templateId: site.templateId,
      dossier,
      styleBrief: brief,
      styleHue: hue,
    });

    // Background image batch — runs post-response, AFTER the quality loop's
    // final draft save (no write race). Patches the shimmer placeholders with
    // real generated images; reaches the published copy too if the owner has
    // already hit «Опублікувати» by then.
    if (needGeneratedImages) {
      const subject = site.imageSubject;
      const verticalIdForGen = vertical.id;
      const altBase = facts.city ? `${facts.businessName}, ${facts.city}` : facts.businessName;
      after(async () => {
        let hero: string | null = null;
        let gallery: string[] = [];
        try {
          const gen = await generateSiteImages({
            verticalId: verticalIdForGen,
            subject,
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
 * in the DRAFT — and, if the owner published mid-flight, the LIVE copy too.
 *
 * Two atomic compare-and-swaps on the genToken close the races an ordinary
 * read-modify-write can't:
 *   1. a newer «Згенерувати ще раз» (different genToken) — the CAS WHERE gates
 *      it, so a stale job touches nothing.
 *   2. a publishDraft landing mid-flight — the published CAS runs AFTER the
 *      draft patch and writes the *resolved* content (real images), not the
 *      stale pending read; because the draft is patched first, any publish that
 *      copies the draft copies real images, and any published copy still on
 *      this token is overwritten with the resolved content.
 * Fail-open: any error is a warn, never a throw.
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
  const { data: tenant } = await sb.from("tenants").select("id").eq("host", host).maybeSingle();
  if (!tenant) return;

  const patchBlocks = (blocks: StoredBlock[]): StoredBlock[] =>
    blocks.map((b) => {
      if (b.type === "hero" && hero && !b.props.imageUrl) {
        return { ...b, props: { ...b.props, imageUrl: hero, imageAlt: `Атмосферне зображення — ${altBase}` } };
      }
      if (b.type === "gallery" && (b.props.pendingImages ?? 0) > 0) {
        // ≥2 real images → fill; else drop the placeholders (renderer hides an
        // empty gallery — a lonely tile reads as a bug).
        const images =
          gallery.length >= 2
            ? gallery.map((url, i) => ({ url, alt: `Атмосферне зображення ${i + 1} — ${altBase}` }))
            : b.props.images;
        return { ...b, props: { title: b.props.title, images } };
      }
      return b;
    });

  const { data: page } = await sb
    .from("pages")
    .select("id, draft_content")
    .eq("tenant_id", tenant.id)
    .eq("slug", "")
    .maybeSingle();
  if (!page) return;

  const draft = (page.draft_content ?? {}) as PageContent;
  if (!Array.isArray(draft.blocks) || draft.genToken !== genToken) return;

  // Everything but the blocks (and the hero this job produced) carries over
  // untouched — design included.
  const resolved: PageContent = {
    ...draft,
    blocks: patchBlocks(draft.blocks),
    ...(hero && { generatedHero: hero }),
  };

  // 1) DRAFT — atomic CAS on the token (the WHERE is re-checked at write time,
  // so a newer generation between our read and write is never clobbered).
  const { data: dRows, error: dErr } = await sb
    .from("pages")
    .update({ draft_content: resolved })
    .eq("id", page.id)
    .eq("draft_content->>genToken", genToken)
    .select("id");
  if (dErr) {
    console.warn(`[publish] draft image patch failed: ${dErr.message}`);
    return;
  }
  if (!dRows?.length) return; // a newer generation won — nothing more to do.

  // 2) PUBLISHED — write the RESOLVED content (not the stale pending read),
  // gated by CAS on the published token. Runs after the draft patch: if a
  // publish copied the (already-resolved) draft it holds real images; if it
  // copied a pending draft first, this overwrites that published copy while it
  // still carries our token. No stale is_published gate — the CAS is the gate.
  // This REPLACES published_content, so it goes through the same draft→published
  // projection publish does. Rebuilding it field by field once dropped the
  // design and left the live site an unstyled wireframe — permanently, since
  // nothing rewrites published_content until the next publish.
  const publishedContent = publishedFromDraft(resolved);
  const { data: pRows, error: pErr } = await sb
    .from("pages")
    .update({ published_content: publishedContent })
    .eq("id", page.id)
    .eq("published_content->>genToken", genToken)
    .select("id");
  if (pErr) {
    console.warn(`[publish] published image patch failed: ${pErr.message}`);
    return;
  }

  // Purge only when the LIVE copy actually changed (§5.5).
  if (pRows?.length) await revalidateTenant(host);
}

/**
 * Promote the draft to the live site: draft_content → published_content,
 * status "published", purge the tenant
 * cache (§5.5/§9.1). The ONLY path that publishes — human- (or admin-)
 * triggered, never called by an agent loop (invariant 6).
 */
export async function publishDraft(host: string): Promise<{ ok: boolean; url: string; error?: string }> {
  const url = publicSiteUrl(host);
  try {
    const sb = getServiceClient();
    const { data: tenant, error: tErr } = await sb
      .from("tenants")
      .select("id")
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

    const draft = (page.draft_content ?? {}) as PageContent;
    if (!draft.blocks?.length) throw new Error("draft is empty — generate before publishing");

    const { error: tUpdErr } = await sb
      .from("tenants")
      .update({ status: "published" })
      .eq("id", tenant.id);
    if (tUpdErr) throw new Error(`tenant publish failed: ${tUpdErr.message}`);

    // Design is promoted with the blocks it belongs to — publishing is the ONLY
    // moment the live site's look changes (invariant 6). genToken rides along
    // so a still-running image job can patch the published copy too.
    const { error: pUpdErr } = await sb
      .from("pages")
      .update({ published_content: publishedFromDraft(draft), is_published: true })
      .eq("id", page.id);
    if (pUpdErr) throw new Error(`page publish failed: ${pUpdErr.message}`);

    // Self-correction for the publish-vs-deferred-image race: if we copied a
    // draft whose gallery was still a pending placeholder, the image job may
    // have resolved the DRAFT (real images) right after our read but skipped
    // OUR published copy (it didn't exist when the job's published-CAS ran). We
    // are the last writer, so re-read the draft and, if it is now resolved,
    // re-copy — otherwise the job's later published-CAS fills it (published now
    // carries this token). Between them every interleaving resolves; a fresh
    // read gated by CAS on the token means we never clobber a newer generation.
    const publishedPending = (draft.blocks ?? []).some(
      (b) => b.type === "gallery" && (b.props.pendingImages ?? 0) > 0,
    );
    if (publishedPending && draft.genToken) {
      // Errors here are NOT swallowed: in this exact race a silent failure
      // would report publish success while the live site stays on shimmer.
      // Throw → the outer catch returns { ok:false }, and a retry republishes
      // the (by-then-resolved) draft cleanly.
      const { data: fresh, error: freshErr } = await sb
        .from("pages")
        .select("draft_content")
        .eq("id", page.id)
        .maybeSingle();
      if (freshErr) throw new Error(`publish self-correct read failed: ${freshErr.message}`);
      const freshDraft = (fresh?.draft_content ?? {}) as PageContent;
      const nowResolved =
        freshDraft.genToken === draft.genToken &&
        !(freshDraft.blocks ?? []).some(
          (b) => b.type === "gallery" && (b.props.pendingImages ?? 0) > 0,
        );
      if (nowResolved) {
        const { error: recopyErr } = await sb
          .from("pages")
          .update({ published_content: publishedFromDraft(freshDraft) })
          .eq("id", page.id)
          .eq("published_content->>genToken", draft.genToken);
        if (recopyErr) throw new Error(`publish self-correct re-copy failed: ${recopyErr.message}`);
      }
    }

    await revalidateTenant(host); // §5.5 / §9.1 purge-on-publish
    return { ok: true, url };
  } catch (e) {
    return { ok: false, url, error: e instanceof Error ? e.message : String(e) };
  }
}
