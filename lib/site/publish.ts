import "server-only";
import { after } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { revalidateTenant } from "@/lib/cache";
import { publicSiteUrl } from "@/lib/config";
import { generateSite, heroVariantForSeed } from "@/lib/ai/generate";
import { generateSiteImages, isImageGenConfigured } from "@/lib/media/generate-image";
import { getVertical } from "@/lib/verticals/registry";
import type { BusinessFacts } from "@/lib/verticals/schema";
import { siteScopedPhotoMeta, type SiteMedia } from "@/lib/media/media";
import { MIN_USABLE_PHOTOS, usablePhotoCount } from "@/lib/media/rank";
import { buildDossier, type Dossier } from "@/lib/dossier";
import { runDraftQualityLoop } from "@/lib/site/inspect";
import { advanceDesignNonce, nonceForBrandWrite, rollAxis } from "@/lib/design/seed";
import { hueForVertical } from "@/lib/design/hue";
import { fontPairForSeed, hueBucketOf, readDesignTuple, shouldReroll, type DesignTuple } from "@/lib/design/axes";
import { buildStyleBrief } from "@/lib/design/style-brief";
import { generateWireStyle } from "@/lib/design/wire-style";
import type { StoredBlock } from "@/lib/blocks/schema";
import { publishedFromDraft, type PageContent } from "@/lib/site/page-content";
import { createLogger } from "@/lib/log";

const log = createLogger("publish");

/**
 * DRAFT/PUBLISH split (refactor 04 §4): generation lands in the DRAFT only —
 * the owner confirms a real preview, then publishDraft() promotes it. The old
 * generateAndPublish() is gone; admin/dev shortcuts call the two in sequence.
 */

/** Generated gallery size for photo-less sites (hero comes on top of these). */
const GENERATED_GALLERY_COUNT = 4;

/**
 * Purge the live site on EVERY host it answers on. A tenant that has been moved
 * to its paid domain serves the same pages under a second cache tag
 * (getTenantByHost matches custom_domain), so purging only the subdomain leaves
 * the domain the owner actually paid for on stale content.
 *
 * The custom domain is read separately and best-effort on purpose: it ships with
 * migration 0009, and publishing must keep working on a DB that hasn't applied
 * it. A read failure here is a missing column, never a reason to fail a publish.
 */
async function revalidateLiveHosts(
  sb: ReturnType<typeof getServiceClient>,
  tenantId: string,
  host: string,
): Promise<void> {
  await revalidateTenant(host);
  const { data } = await sb
    .from("tenants")
    .select("custom_domain")
    .eq("id", tenantId)
    .maybeSingle();
  const custom = (data as { custom_domain?: string | null } | null)?.custom_domain;
  if (custom && custom !== host) await revalidateTenant(custom);
}

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

    // Pre-read: previous brand (tuple guard + spread fallback) and the page's
    // stored stylesheet (fail-open seed below).
    const sbPre = getServiceClient();
    const { data: prevRow, error: prevErr } = await sbPre
      .from("tenants")
      .select("id, brand")
      .eq("host", host)
      .maybeSingle();
    // A transient read failure must not masquerade as «new tenant» and reset
    // the tuple/brand history (codex review) — fail loudly, the caller retries.
    if (prevErr) throw new Error(`tenant pre-read failed: ${prevErr.message}`);
    const prevBrand = (prevRow?.brand ?? {}) as Record<string, unknown>;
    // Generation nonce — advanced ATOMICALLY via RPC before any model call
    // (spec v2 §4): the old read+1 spanned the ~2min model chain, so two
    // parallel generations of one host shared every seed. Falls back to
    // read+1 when the RPC is missing; the brand write below persists it then.
    const designNonce = await advanceDesignNonce(sbPre, host);
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

    // Seeded axes (spec v2 §4). V1 consumes the hue (wire-style) and the
    // hero-variant default; the font proposal only rides the tuple until the
    // S1 brief (V2) starts reading it. Tuple guard: when the seeded proposals
    // repeat the previous generation on font AND hero variant AND hue bucket,
    // take ONE extra roll («-reroll» purposes) and keep whatever comes — no
    // loop, A→B→A stays legal. `heroVariant` compares the SEEDED proposal
    // (banner veto ignored — stable across photo changes), never the model's
    // final choice: pre-S1 proposals are cheap, a second model call is not.
    const prevTuple = readDesignTuple(prevBrand.lastDesignTuple);
    const seededProposal = (suffix: "" | "-reroll") => {
      const hue = hueForVertical(rollAxis(host, designNonce, `hue${suffix}`), vertical.id);
      const variantRoll = rollAxis(host, designNonce, `variant${suffix}`);
      return {
        hue,
        altHue: hueForVertical(rollAxis(host, designNonce, `hue-alt${suffix}`), vertical.id),
        variantRoll,
        tuple: {
          font: fontPairForSeed(rollAxis(host, designNonce, `font${suffix}`), vertical.id).id,
          heroVariant: heroVariantForSeed(variantRoll, true),
          hueBucket: hueBucketOf(hue),
        } satisfies DesignTuple,
      };
    };
    let seeded = seededProposal("");
    if (shouldReroll(prevTuple, seeded.tuple)) seeded = seededProposal("-reroll");

    // Background image generation (owner decision: «сайт має бути гарний і без
    // фото»): with zero owner photos the site ships IMMEDIATELY — hero text-only,
    // gallery with shimmer placeholders — and the images arrive via after()
    // below, patched into the draft AND the published copy if already live.
    // Gated on an image-gen key: without it the placeholders would never
    // resolve, so we skip the shimmer path entirely (site renders text-only).
    //
    // The trigger is USABLE photos, not «zero photos» (plan §1.5): a site whose
    // photos were all vision-rejected used to read as "has photos" and shipped
    // a gallery of nothing, while a site whose photos were merely wiped by a
    // sanitize failure bought AI imagery it didn't need. Three usable photos are
    // enough to carry a site — past that we NEVER generate, which was the
    // owner's actual complaint.
    const usable = media ? usablePhotoCount(media) : 0;
    const needGeneratedImages =
      usable < MIN_USABLE_PHOTOS && !media?.generatedHero && isImageGenConfigured();
    log.info("generated images decision", {
      host,
      usable,
      total: media?.photos?.length ?? 0,
      generate: needGeneratedImages,
    });
    if (needGeneratedImages) {
      media = { ...(media ?? { photos: [] }), generatedPending: GENERATED_GALLERY_COUNT };
    }

    const dossier = opts.dossier ?? buildDossier({ facts, media: media ?? null });
    // ONE deadline across the whole synchronous model chain (composition +
    // stylesheet). Per-call SDK timeouts only bound a single hung attempt —
    // two calls × retries could still outlive the 300s serverless budget and
    // die as a bare 504. 240s leaves headroom for DB writes and the response.
    const modelDeadline = AbortSignal.timeout(240_000);
    // The model composes against the wireframe: it picks WHICH sections this
    // business needs, in WHAT order, and writes the copy. No template choice,
    // no seeded variant juggling, no section shuffle — the composition is the
    // model's, end to end.
    // Fifth arg seeds the hero-variant default (wave B): same nonce contract
    // as the hue, so «згенерувати ще раз» can change the composition too.
    const site = await generateSite(dossier, vertical.id, media, modelDeadline, seeded.variantRoll);

    // The model then writes this tenant's stylesheet for the composition it
    // just produced. Fail-open: if styling dies the draft still ships — grey,
    // but complete, editable and publishable.
    let wireCss: string | undefined = prevWireCss;
    const brief = buildStyleBrief({
      facts,
      vertical,
      sectionTypes: site.blocks.map((b) => b.type),
    });
    // Hue seeded off host+nonce, CONFINED to the vertical's declared ranges
    // (lib/design/hue.ts): two businesses in one niche start from different
    // colour worlds, but a bakery can no longer draw acid green. «Згенерувати
    // ще раз» moves to another roll. altHue = an independent second roll for
    // the style-audit's one regen, so a rejected colour world isn't retried.
    const hue = seeded.hue;
    const altHue = seeded.altHue;
    try {
      wireCss = (await generateWireStyle(brief, { hue, signal: modelDeadline })).css;
    } catch (e) {
      log.error("styling failed", { host, error: e });
    }

    const sb = getServiceClient();
    const brandPhotoMeta = siteScopedPhotoMeta(media);

    // brand is written as a SPREAD, never rebuilt field-by-field (spec v2 §4,
    // spread-what-you-read extended to brand): generation owns its fields;
    // anything set while the ~2min model chain ran — the logo action writes
    // brand directly — must survive. Re-read at write time (the pre-read is
    // minutes stale by now); a transient failure falls back to the pre-read
    // copy — stale-but-real beats aborting a finished generation.
    let baseBrand = prevBrand;
    {
      const { data: freshRow, error: freshErr } = await sb
        .from("tenants")
        .select("brand")
        .eq("host", host)
        .maybeSingle();
      if (freshErr) {
        log.warn("brand re-read failed, spreading the pre-read copy", { host, error: freshErr.message });
      } else if (freshRow?.brand) {
        baseBrand = freshRow.brand as Record<string, unknown>;
      }
    }

    // The spread must NOT carry generation-owned media: photos/photoMeta/
    // generatedHero have no concurrent writer (the only other brand writer is
    // logo-actions, which touches logoUrl alone), so a stale copy surviving the
    // spread would resurrect photos the owner removed — the next «Згенерувати
    // ще раз» reads brand.photos as the authoritative set and re-casts them
    // onto the site (review must-fix). Strip them from the base; the gated
    // writes below re-add whatever THIS generation actually has.
    const carriedBrand: Record<string, unknown> = { ...baseBrand };
    delete carriedBrand.photos;
    delete carriedBrand.photoMeta;
    delete carriedBrand.generatedHero;

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
            ...carriedBrand,
            businessName: facts.businessName,
            // The seed counter for the design axes — a generation COUNTER, not
            // a design, so the unversioned `brand` is its right home. The
            // design itself (templateId + wireCss) rides draft_content, because
            // a draft-only regeneration must never change the live site
            // (invariant 6). Clamped against the freshly-read base: the RPC
            // already persisted OUR bump, and a parallel generation may have
            // bumped further since — writing the captured value back verbatim
            // could move the counter backwards and replay its seeds
            // (review must-fix; see nonceForBrandWrite).
            designNonce: nonceForBrandWrite(designNonce, baseBrand.designNonce),
            // The seeded proposals THIS generation started from — the next
            // run's tuple guard reads it (spec v2 §4). Rides the spread like
            // every other generation-owned field.
            lastDesignTuple: seeded.tuple,
            ...(media?.logoUrl && { logoUrl: media.logoUrl }),
            ...(media?.photos?.length && { photos: media.photos }),
            // The vision verdicts travel WITH the photos: `brand` is the only
            // thing the editor's «Згенерувати ще раз» reads, so without this the
            // regeneration lost every vetting signal and re-picked a hero blind
            // (plan §1.7). Trimmed — see siteScopedPhotoMeta.
            ...(brandPhotoMeta.length && { photoMeta: brandPhotoMeta }),
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
      styleAltHue: altHue,
      signal: modelDeadline,
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
          log.warn("deferred image gen failed", { host, error: e });
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
          log.warn("deferred image patch failed", { host, error: e });
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
        // Generated images come AFTER the owner's own (§4.8: real photos are
        // never displaced — with the usable-photo trigger this block can carry
        // one real photo already). ≥2 tiles → fill; else resolve to an empty
        // gallery, which the renderer hides — a lonely tile reads as a bug.
        const merged = [
          ...b.props.images,
          ...gallery.map((url, i) => ({ url, alt: `Атмосферне зображення ${i + 1} — ${altBase}` })),
        ];
        const images = merged.length >= 2 ? merged : [];
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
    log.warn("draft image patch failed", { host, error: dErr.message });
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
    log.warn("published image patch failed", { host, error: pErr.message });
    return;
  }

  // Purge only when the LIVE copy actually changed (§5.5).
  if (pRows?.length) await revalidateLiveHosts(sb, tenant.id as string, host);
}

/**
 * Promote the draft to the live site: draft_content → published_content,
 * status "published", purge the tenant
 * cache (§5.5/§9.1). The ONLY path that publishes — human- (or admin-)
 * triggered, never called by an agent loop (invariant 6).
 *
 * FREE (owner decision 2026-08-06, superseding spec 2026-08-05 §3): going live
 * on our subdomain costs nothing, so there is no gate here at all. The ₴999 now
 * buys the CUSTOM DOMAIN — that gate lives in requestDomainAction
 * (app/app/new/domain-actions.ts), the one step the money is actually for.
 */
export async function publishDraft(
  host: string,
): Promise<{ ok: boolean; url: string; error?: string }> {
  const url = publicSiteUrl(host);
  try {
    const sb = getServiceClient();
    const { data: tenant, error: tErr } = await sb
      .from("tenants")
      .select("id")
      .eq("host", host)
      .maybeSingle();
    if (tErr || !tenant) {
      throw new Error(`tenant read failed: ${tErr?.message ?? "not found"}`);
    }

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

    await revalidateLiveHosts(sb, tenant.id, host); // §5.5 / §9.1 purge-on-publish
    return { ok: true, url };
  } catch (e) {
    return { ok: false, url, error: e instanceof Error ? e.message : String(e) };
  }
}
