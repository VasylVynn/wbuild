import "server-only";
import { after } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { revalidateTenant } from "@/lib/cache";
import { generateSite, heroVariantForSeed, sectionVariantForRoll } from "@/lib/ai/generate";
import { buildWireframeCapabilities, generateDesignBrief } from "@/lib/ai/design-brief";
import { generateSiteImages, isImageGenConfigured } from "@/lib/media/generate-image";
import { getVertical } from "@/lib/verticals/registry";
import type { BusinessFacts } from "@/lib/verticals/schema";
import {
  MAX_PHOTOS,
  siteScopedPhotoMeta,
  type PhotoMeta,
  type SiteMedia,
} from "@/lib/media/media";
import { MIN_USABLE_PHOTOS, usablePhotoCount } from "@/lib/media/rank";
import { aggregatePalette, eligiblePaletteMetas, extractPalette, measureLogoPlateFromUrl } from "@/lib/media/palette";
import { ensureAdaptedLogo } from "@/lib/media/logo";
import { buildDossier, buildDossierForTenant, type Dossier } from "@/lib/dossier";
import { runDraftQualityLoop } from "@/lib/site/inspect";
import { advanceDesignNonce, nonceForBrandWrite, rollAxis } from "@/lib/design/seed";
import { hueForVertical } from "@/lib/design/hue";
import {
  directionForSeed,
  fontPairForSeed,
  hueBucketOf,
  motionLevelForSeed,
  readDesignTuple,
  shouldReroll,
  type DesignTuple,
  type MotionLevel,
} from "@/lib/design/axes";
import { FONT_FAMILIES, getFontPair } from "@/lib/design/font-pairs";
import { buildStyleBrief } from "@/lib/design/style-brief";
import { buildFallbackWireCss } from "@/lib/design/fallback-style";
import { generateWireStyle, WIRE_TEMPLATE_ID } from "@/lib/design/wire-style";
import { getTemplate } from "@/lib/templates/registry";
import type { StoredBlock } from "@/lib/blocks/schema";
import type { DesignSpec } from "@/lib/site/design-spec";
import { publishedFromDraft, type PageContent } from "@/lib/site/page-content";
import { casUpdateDraft, readContentRev } from "@/lib/site/draft-cas";
import {
  buildDraftContent,
  compileWireCss,
  planBlockTypes,
  type PipelineMode,
} from "@/lib/site/pipeline-compile";
import { createLogger } from "@/lib/log";

// The deterministic S3 pieces live in ./pipeline-compile (pure — the write
// contract is vitest-proved there); this module is their only consumer plus
// the re-export surface.
export {
  buildDraftContent,
  compileWireCss,
  planBlockTypes,
  type PipelineMode,
} from "@/lib/site/pipeline-compile";
export type { DraftBuildInput } from "@/lib/site/pipeline-compile";

const log = createLogger("pipeline");

/**
 * The unified staged generation pipeline (spec 2026-08-07 §3/§6/§8/§9) — ONE
 * module behind both «primary generation» (generateDraft, mode "onboard") and
 * the editor's «Згенерувати ще раз» (regenerateSite, mode "editor").
 *
 *   S0 grounding   deterministic photo palette (≤5s, fail-open)
 *   S1 brief       one model call → designSpec (≤40s, null → v1 path)
 *   S2а ∥ S2б      stylesheet ∥ composition (allSettled, ≤120s each, no retries)
 *   S3 compile     deterministic: lint BEFORE persist, reconcile, ONE draft write
 *                  → the preview point (s3_compile done = TFAO)
 *   S4 QA          after the preview, its OWN ≤150s budget, all writes CAS'd
 *
 * Everything the two old paths did differently on purpose is in the §8 write
 * contract (buildDraftContent + the brand writes); everything they did
 * differently by ACCIDENT is gone.
 */

export type PipelineStage = "s0_grounding" | "s1_brief" | "s2_generate" | "s3_compile" | "s4_qa";
export type PipelineStageStatus = "start" | "done" | "skipped" | "error";
export interface PipelineStageEvent {
  stage: PipelineStage;
  status: PipelineStageStatus;
  detail?: Record<string, unknown>;
}

export interface PipelineInput {
  host: string;
  facts: BusinessFacts;
  verticalId: string;
  media?: SiteMedia;
  /** The rich per-business context (03 §1.5). Absent → a bare facts+media
   *  dossier is built here (admin fixtures, dev smokes, editor regen). */
  dossier?: Dossier;
  mode: PipelineMode;
  /** Stage-boundary notifications — the /api/generate SSE transport maps these
   *  onto stream events + the generation_progress store. Fail-open: a throwing
   *  listener is logged and never takes generation down. `s3_compile done` is
   *  the preview-ready point. */
  onStage?: (event: PipelineStageEvent) => void | Promise<void>;
  /** Caller's own abort (e.g. the SSE request). Combined with the pipeline's
   *  240s chain deadline — created HERE, at the start, so every stage budget
   *  is `AbortSignal.any([chain, timeout(stage)])` (spec §6). */
  signal?: AbortSignal;
}

export interface PipelineResult {
  ok: boolean;
  host: string;
  /** The S3 (shipped) blocks — the editor updates its UI from these. */
  blocks?: StoredBlock[];
  /** The S3 (shipped) DESIGN, for the same reason and by the same route. The
   *  editor holds the sheet in state, so anything it is not handed here it
   *  cannot show until the page is reloaded. Returned from memory rather than
   *  re-read from the row: a second read is a second thing that can fail, and
   *  its failure would look exactly like «the design did not change». */
  wireCss?: string;
  designSpec?: DesignSpec;
  error?: string;
}

// Budgets (spec §6). TFAO = S0+S1+max(S2а,S2б)+S3 ≤ ~165s worst; the chain
// deadline caps the whole synchronous model part with headroom for DB writes.
const CHAIN_BUDGET_MS = 240_000;
const S0_BUDGET_MS = 5_000;
/** Measured live: adaptive thinking alone can spend 20-30s before the tool
 *  call; a 40s budget aborted S1 on a real regen (v1 fallback = no designSpec,
 *  no fonts/motion — the headline feature silently off). 60s keeps the chain
 *  at 5+60+150+~5 ≈ 220s ≤ 240s. */
const S1_BUDGET_MS = 60_000;
/** Content leg (composition) — measured 44–79s pre-v2, unchanged inputs. */
const S2B_BUDGET_MS = 120_000;
/** Style leg: the V3 wireframe grew the prompt (wire.css + sections.tsx),
 *  and a measured regen aborted at 120s with the sheet mid-write — the
 *  fallback then ships the PREVIOUS sheet, so the palette silently stops
 *  varying. 150s keeps TFAO ≤ ~195s worst inside the 240s chain. V5 slimmed
 *  the prompt (sections.tsx cut to the sectionPlan's sections when a
 *  designSpec exists — lib/design/wire-source.ts, per-call size logged by
 *  wire-style); the budget stays until the new timings are measured live. */
const S2A_BUDGET_MS = 150_000;
/** S4 runs on its OWN clock — after the preview, never chain time — but is
 *  additionally clamped to what remains of the request wall clock below. */
const S4_BUDGET_MS = 150_000;
/** The platform kills the handler at `maxDuration = 300` (both transports).
 *  S4 must fit inside what's LEFT of that wall clock after the chain — an
 *  unclamped 150s on top of a 240s chain could run to 390s, and dying mid-S4
 *  is how deferred work gets lost. 290s leaves headroom for the final writes. */
const REQUEST_WALL_MS = 290_000;
/** A corrective style regen starts only while enough of the S4 budget remains
 *  to fit one CSS call + re-lint + re-verdict. (At 120s the window after the
 *  first verdict — itself a model call — was arithmetically almost never open,
 *  silently disabling the corrective regen that always ran pre-v2.) */
const S4_REGEN_MIN_REMAINING_MS = 60_000;

/** Generated gallery size for photo-less sites (hero comes on top of these). */
const GENERATED_GALLERY_COUNT = 4;
/** The ONE heading a gallery holding generated imagery may carry. Kept next to
 *  the count because they describe the same thing: tiles that are atmosphere,
 *  not a portfolio. Mirrored by the code-injected fallback in lib/ai/generate.ts. */
const GENERATED_GALLERY_TITLE = "Наша атмосфера";

/** Human-readable font-pair name for the V4 progress cards («Playfair Display
 *  + Inter») — the chat shows the real S1 pick, never the raw pair id. */
function fontPairLabel(pairId: string): string {
  const pair = getFontPair(pairId);
  if (!pair) return pairId;
  return `${FONT_FAMILIES[pair.heading].label} + ${FONT_FAMILIES[pair.body].label}`;
}

// ---------------------------------------------------------------------------
// S0 — deterministic palette grounding (≤5s, fail-open).
// ---------------------------------------------------------------------------

/**
 * Aggregate the stored per-photo palettes; when no photo carries one (rows
 * from before wave V1), recompute from the bucket within the S0 budget —
 * ≤MAX_PHOTOS GETs + sharp, every failure silently drops that photo. Any
 * overrun aborts the fetches and we ship whatever aggregated (spec §3-S0:
 * fail-open → the vertical hue window remains the fallback).
 */
async function groundPaletteCandidates(
  media: SiteMedia | undefined,
  signal: AbortSignal,
): Promise<{ palette: string[]; photosUsed: number }> {
  try {
    const metas = media?.photoMeta ?? [];
    const stored = aggregatePalette(metas);
    if (stored.length) return { palette: stored, photosUsed: eligiblePaletteMetas(metas).length };

    const urls = (media?.photos ?? []).slice(0, MAX_PHOTOS);
    if (!urls.length) return { palette: [], photosUsed: 0 };
    const byUrl = new Map(metas.map((m) => [m.url, m]));
    const recomputed = await Promise.all(
      urls.map(async (url): Promise<PhotoMeta | null> => {
        try {
          const res = await fetch(url, { signal });
          if (!res.ok) return null;
          const palette = await extractPalette(Buffer.from(await res.arrayBuffer()));
          if (!palette) return null;
          // Carry the stored vetting signals so aggregatePalette's eligibility
          // and weighting still apply; an unrated photo gets the usual benefit
          // of the doubt.
          return { ...(byUrl.get(url) ?? { url }), url, palette };
        } catch {
          return null;
        }
      }),
    );
    const withPalette = recomputed.filter((m): m is PhotoMeta => m !== null);
    return {
      palette: aggregatePalette(withPalette),
      photosUsed: eligiblePaletteMetas(withPalette).length,
    };
  } catch (e) {
    log.warn("S0 palette grounding failed (fail-open)", {
      error: e instanceof Error ? e.message : String(e),
    });
    return { palette: [], photosUsed: 0 };
  }
}

// ---------------------------------------------------------------------------
// Seeded proposals + tuple guard (spec §4) — factored out of the two old paths.
// ---------------------------------------------------------------------------

interface SeededDesign {
  hue: number;
  altHue: number;
  variantRoll: number;
  motionLevel: MotionLevel;
  direction: string;
  tuple: DesignTuple;
}

/**
 * Tuple-guarded seeded proposals (spec §4) — the ONE implementation the two
 * old paths used to fork: one extra roll when font AND hero variant AND hue
 * bucket all repeat the previous generation (A→B→A stays legal; never loops).
 * `heroVariant` compares the SEEDED proposal (banner veto ignored — stable
 * across photo changes), never the model's final choice: pre-S1 proposals are
 * cheap, a second model call is not.
 */
function seededDesignWithGuard(
  host: string,
  nonce: number,
  verticalId: string,
  prevTuple: DesignTuple | undefined,
): SeededDesign {
  const roll = (suffix: "" | "-reroll"): SeededDesign => {
    const hue = hueForVertical(rollAxis(host, nonce, `hue${suffix}`), verticalId);
    const variantRoll = rollAxis(host, nonce, `variant${suffix}`);
    return {
      hue,
      altHue: hueForVertical(rollAxis(host, nonce, `hue-alt${suffix}`), verticalId),
      variantRoll,
      motionLevel: motionLevelForSeed(rollAxis(host, nonce, `motion${suffix}`), verticalId),
      direction: directionForSeed(rollAxis(host, nonce, `direction${suffix}`)),
      tuple: {
        font: fontPairForSeed(rollAxis(host, nonce, `font${suffix}`), verticalId).id,
        heroVariant: heroVariantForSeed(variantRoll, true),
        hueBucket: hueBucketOf(hue),
      } satisfies DesignTuple,
    };
  };
  const first = roll("");
  return shouldReroll(prevTuple, first.tuple) ? roll("-reroll") : first;
}

// ---------------------------------------------------------------------------
// runPipeline
// ---------------------------------------------------------------------------

export async function runPipeline(opts: PipelineInput): Promise<PipelineResult> {
  const { host, facts, verticalId, mode } = opts;
  const runStart = Date.now();
  const genToken = crypto.randomUUID();
  let stage: PipelineStage = "s0_grounding";
  const emit = async (event: PipelineStageEvent) => {
    stage = event.stage;
    try {
      await opts.onStage?.(event);
    } catch (e) {
      log.warn("onStage listener failed (ignored)", {
        host,
        stage: event.stage,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  };

  // The chain deadline is created HERE, at the very start (spec §6): the old
  // flow started its 240s clock after the pre-reads, so the S0-equivalent ran
  // outside any deadline. Editor mode gets the same deadline (owner decision
  // Q6) — regeneration used to be unbounded.
  const chain = opts.signal
    ? AbortSignal.any([opts.signal, AbortSignal.timeout(CHAIN_BUDGET_MS)])
    : AbortSignal.timeout(CHAIN_BUDGET_MS);
  const stageSignal = (budgetMs: number) => AbortSignal.any([chain, AbortSignal.timeout(budgetMs)]);

  try {
    const vertical = getVertical(verticalId);
    const template = getTemplate(WIRE_TEMPLATE_ID);
    const sb = getServiceClient();

    // Pre-reads: previous brand (tuple guard + spread fallback) and the page's
    // stored draft (pocket, stylesheet fallback, contentRev baseline). A
    // transient read failure must not masquerade as «new tenant» / «no stored
    // sheet» — fail loudly, the caller retries (codex review, unchanged).
    const { data: prevRow, error: prevErr } = await sb
      .from("tenants")
      .select("id, brand")
      .eq("host", host)
      .maybeSingle();
    if (prevErr) throw new Error(`tenant pre-read failed: ${prevErr.message}`);
    if (mode === "editor" && !prevRow?.id) throw new Error("tenant not found");
    const prevBrand = (prevRow?.brand ?? {}) as Record<string, unknown>;

    // Nonce advanced ATOMICALLY via RPC before any model call (spec §4).
    const designNonce = await advanceDesignNonce(sb, host);

    let pageId: string | undefined;
    let oldDraft: PageContent | undefined;
    if (prevRow?.id) {
      const { data: prevPage, error: prevPageErr } = await sb
        .from("pages")
        .select("id, draft_content")
        .eq("tenant_id", prevRow.id as string)
        .eq("slug", "")
        .maybeSingle();
      if (prevPageErr) throw new Error(`page pre-read failed: ${prevPageErr.message}`);
      pageId = prevPage?.id as string | undefined;
      oldDraft = (prevPage?.draft_content ?? undefined) as PageContent | undefined;
    }
    if (mode === "editor" && !pageId) throw new Error("page not found");
    const prevWireCss = oldDraft?.wireCss;

    // §8: editor's generatedHero comes from the old draft (already paid for —
    // regeneration never mints a new image); onboard's rides `media`/brand.
    let media = opts.media;
    if (mode === "editor" && !media?.generatedHero && oldDraft?.generatedHero) {
      media = { ...(media ?? { photos: [] }), generatedHero: oldDraft.generatedHero };
    }

    // ── S0: deterministic grounding ─────────────────────────────────────────
    await emit({ stage: "s0_grounding", status: "start" });
    const grounded = await groundPaletteCandidates(media, stageSignal(S0_BUDGET_MS));
    const paletteCandidates = grounded.palette;
    await emit({
      stage: "s0_grounding",
      status: "done",
      // The chat card labels off `photosUsed` — `paletteCandidates` counts
      // aggregated COLOURS, not photos (one photo yields ~5 hexes).
      // `photosTotal` lets the card distinguish «no photos supplied» from
      // «photos supplied but unusable / S0 timed out» (both aggregate to 0).
      detail: {
        paletteCandidates: paletteCandidates.length,
        photosUsed: grounded.photosUsed,
        photosTotal: media?.photos?.length ?? 0,
      },
    });

    const prevTuple = readDesignTuple(prevBrand.lastDesignTuple);
    const seeded = seededDesignWithGuard(host, designNonce, vertical.id, prevTuple);

    // Background image generation (onboard only — the editor path reuses what
    // exists): with too few usable photos the site ships IMMEDIATELY with
    // shimmer placeholders, and the images arrive via after() below.
    const usable = media ? usablePhotoCount(media) : 0;
    // ANY mode, deliberately (live loss, avtomaister 2026-08-12): the owner
    // regenerated from the editor ~30 minutes after onboarding, BEFORE the
    // deferred image job had patched the shimmer gallery — and the editor run,
    // gated to onboard-only, armed nothing. The new draft had no gallery, no
    // hero, nothing pending; the orphaned job lost its CAS; the naked site got
    // published. A photo-less site needs the imagery whichever path rebuilt it.
    // `!media?.generatedHero` still stops double-paying: an editor run carries
    // the already-generated hero in, and a site that HAS one keeps it.
    const needGeneratedImages =
      usable < MIN_USABLE_PHOTOS &&
      !media?.generatedHero &&
      isImageGenConfigured();
    log.info("generated images decision", {
      host,
      usable,
      total: media?.photos?.length ?? 0,
      generate: needGeneratedImages,
    });
    if (needGeneratedImages) {
      media = { ...(media ?? { photos: [] }), generatedPending: GENERATED_GALLERY_COUNT };
    }

    // Dossier resolution — ONE rule for every entry point. The onboarding flow
    // hands us a conversation dossier; the paths that don't (editor
    // regeneration, admin test-generation, dev smokes) used to fall straight to
    // a bare facts+media dossier, which silently dropped the Instagram snapshot
    // — the site's only evidence that its copy describes a real business. If a
    // tenant row exists, resolve the tenant dossier first (snapshot included,
    // found by tenant OR through the tenant's conversations); fail-open to the
    // bare one so a missing table or an unlinked scrape can never block a run.
    let dossier = opts.dossier;
    if (!dossier && prevRow?.id) {
      dossier =
        (await buildDossierForTenant(prevRow.id as string, {
          media: media ?? null,
          facts,
        })) ?? undefined;
    }
    dossier ??= buildDossier({ facts, media: media ?? null });

    // ── S1: design brief (fail-open → v1 path) ──────────────────────────────
    await emit({ stage: "s1_brief", status: "start" });
    const s1At = Date.now();
    const capabilities = buildWireframeCapabilities();
    const seededCtaVariant = sectionVariantForRoll(
      template?.sections.cta,
      rollAxis(host, designNonce, "variant:cta"),
    );
    const brief = await generateDesignBrief({
      dossier,
      verticalId: vertical.id,
      paletteCandidates,
      seededProposals: {
        fontPairId: seeded.tuple.font,
        motionLevel: seeded.motionLevel,
        direction: seeded.direction,
        // cta gets a seeded proposal for the same reason hero did: it is the
        // one CONTENT-FREE variant choice in the plan, and with nothing to
        // reason from the model took the first-described layout every time —
        // measured across every live tenant: cta:band on all of them, three
        // registered variants never shown. Same roll stream as the fallback
        // (`variant:cta`), so a plan that omits cta lands on the same answer.
        sectionVariants: {
          hero: seeded.tuple.heroVariant,
          ...(seededCtaVariant && { cta: seededCtaVariant }),
        },
        hue: seeded.hue,
      },
      wireframeCapabilities: capabilities,
      signal: stageSignal(S1_BUDGET_MS),
    });
    await emit({
      stage: "s1_brief",
      status: "done",
      detail: brief
        ? {
            briefed: true,
            repairs: brief.repairs,
            elapsedMs: Date.now() - s1At,
            // V4 progress cards: the human-readable design picks the chat
            // shows — real S1 output, never a client-side invention.
            fontPairLabel: fontPairLabel(brief.spec.typography.pairId),
            accent: brief.spec.palette.accent,
            motionLevel: brief.spec.motion.level,
            sectionCount: brief.spec.sectionPlan.length,
          }
        : { briefed: false, fallback: "v1", elapsedMs: Date.now() - s1At },
    });
    // Budget tuning is data-driven from here on — every stage logs elapsed.
    log.info("s1 elapsed", { host, ms: Date.now() - s1At, briefed: Boolean(brief) });

    // ── S2а ∥ S2б: stylesheet ∥ composition ─────────────────────────────────
    await emit({ stage: "s2_generate", status: "start" });
    const s2At = Date.now();
    // The style brief's section line comes from the PLAN now (the legs run in
    // parallel, the composition doesn't exist yet); no brief → the line drops
    // (v1 degradation) instead of serializing the legs.
    const styleBrief = buildStyleBrief({
      facts,
      vertical,
      ...(brief && { sectionTypes: planBlockTypes(brief.spec.sectionPlan, template) }),
    });
    // Per-leg progress (V4 cards, spec §7): each leg reports its own settle as
    // a mid-stage event — the stage status stays "start" (S2 itself is still
    // running); `detail.leg` + `detail.status` carry the leg outcome.
    // Fire-and-forget is safe: emit guards a throwing listener, and the SSE
    // `send` runs synchronously inside onStage, so wire order is preserved.
    const legSettled = (
      leg: "content" | "style",
      ok: boolean,
      extra?: Record<string, unknown>,
    ): void =>
      void emit({
        stage: "s2_generate",
        status: "start",
        detail: { leg, status: ok ? "done" : "error", elapsedMs: Date.now() - s2At, ...extra },
      });
    // allSettled, NOT all: a styling failure must not kill a finished
    // composition (spec §3). Retries are disabled per-call inside both legs —
    // one attempt IS the 120s stage budget (spec §6).
    const [siteRes, cssRes] = await Promise.allSettled([
      generateSite(
        dossier,
        vertical.id,
        media,
        stageSignal(S2B_BUDGET_MS),
        seeded.variantRoll,
        brief?.spec,
        // Per-section variant fallback (spec §4): one independent seeded
        // stream per section id. Hero stays on the legacy `variant` purpose
        // (seeded.variantRoll above) — renaming a purpose string re-rolls the
        // axis for every existing tenant, so the old stream is kept as-is.
        (sectionId) => rollAxis(host, designNonce, `variant:${sectionId}`),
      ).then(
        (v) => {
          legSettled("content", true);
          return v;
        },
        (e) => {
          legSettled("content", false);
          throw e;
        },
      ),
      generateWireStyle(styleBrief, {
        // hue is consumed only when the brief is null (designSpec supersedes it).
        hue: seeded.hue,
        designSpec: brief?.spec,
        signal: stageSignal(S2A_BUDGET_MS),
      }).then(
        (v) => {
          legSettled("style", true);
          return v;
        },
        (e) => {
          // What the compile fallback will ACTUALLY ship — the chat's
          // degradation line must be honest per tenant history (spec §3-S2а).
          legSettled("style", false, { fallback: prevWireCss ? "previous" : "default" });
          throw e;
        },
      ),
    ]);
    if (siteRes.status === "rejected") {
      // S2б fail → honest error, NOTHING persisted (spec §3; §10 fail-open
      // applies to every stage but this one). The outer catch emits the
      // s2_generate error event.
      const reason =
        siteRes.reason instanceof Error ? siteRes.reason.message : String(siteRes.reason);
      throw new Error(`composition failed: ${reason}`);
    }
    const site = siteRes.value;
    let rawCss: string | undefined;
    if (cssRes.status === "fulfilled") {
      rawCss = cssRes.value.css;
    } else {
      // S2а fail → previous sheet for an existing tenant, grey wireframe for a
      // first generation. Honest, retry buys a new roll.
      log.error("styling failed", { host, error: cssRes.reason });
    }
    await emit({
      stage: "s2_generate",
      status: "done",
      detail: {
        styled: rawCss !== undefined,
        elapsedMs: Date.now() - s2At,
        // Leg summary (V4 cards): backfills a leg whose own mid-stage event
        // was lost on the wire. Content is always "done" here — its rejection
        // throws above and never reaches this emit.
        content: "done",
        style: rawCss !== undefined ? "done" : "error",
        ...(rawCss === undefined && {
          styleFallback: prevWireCss ? "previous" : "default",
        }),
      },
    });
    log.info("s2 elapsed", { host, ms: Date.now() - s2At, styled: rawCss !== undefined });

    // ── S3: deterministic compile + THE draft write ─────────────────────────
    await emit({ stage: "s3_compile", status: "start" });
    const compiled = compileWireCss(rawCss, prevWireCss);
    // NEVER ship a site with no stylesheet. When the style leg fails on a brand
    // new tenant there is no previous sheet to fall back to, and the compile
    // returns nothing — the site went live as the bare grey wireframe, and the
    // S4 audit called it «pass» because an absent sheet has no violations. The
    // seeded hue, font pair and motion level are all computed BEFORE any model
    // is called, so a plain but real design is always available for free.
    if (!compiled.wireCss) {
      compiled.wireCss = buildFallbackWireCss({
        hue: seeded.hue,
        pairId: brief?.spec.typography.pairId ?? seeded.tuple.font,
        motionLevel: brief?.spec.motion.level ?? seeded.motionLevel,
        // The usual brownout shape is S1 fine + S2а dead: the good palette is
        // already IN the brief — the floor must wear it, not pastel defaults.
        palette: brief?.spec.palette,
      });
      compiled.lintNotes.push("style leg produced nothing — shipped the seeded fallback sheet");
      log.warn("no model stylesheet — using the seeded fallback", { host });
    }
    if (compiled.lintNotes.length) {
      // The notes THEMSELVES, not a count (invariant 10): when S4 is skipped
      // on the deadline, styleAudit.compileNotes is never written and this log
      // line is the ONLY trace of a strip or the 60k size truncation.
      log.info("wire css compiled", { host, notes: compiled.lintNotes.slice(0, 40) });
    }
    const draftContent = buildDraftContent({
      mode,
      oldDraft,
      blocks: site.blocks,
      templateId: site.templateId,
      seo: site.seo,
      wireCss: compiled.wireCss,
      brief,
      shippedPlan: site.shippedPlan,
      genToken,
      ...(mode === "editor" && media?.generatedHero && { generatedHero: media.generatedHero }),
    });

    // brand is written as a SPREAD, never rebuilt field-by-field (spec §4):
    // re-read at write time (the pre-read is minutes stale); a transient
    // failure falls back to the pre-read copy — stale-but-real beats aborting
    // a finished generation.
    let baseBrand = prevBrand;
    {
      const { data: freshRow, error: freshErr } = await sb
        .from("tenants")
        .select("brand")
        .eq("host", host)
        .maybeSingle();
      if (freshErr) {
        log.warn("brand re-read failed, spreading the pre-read copy", {
          host,
          error: freshErr.message,
        });
      } else if (freshRow?.brand) {
        baseBrand = freshRow.brand as Record<string, unknown>;
      }
    }
    const brandSeedFields = {
      // Clamped: the RPC already persisted OUR bump, a parallel generation may
      // have bumped further — never move the counter backwards (spec §4).
      designNonce: nonceForBrandWrite(designNonce, baseBrand.designNonce),
      // The seeded proposals THIS generation started from — the next run's
      // tuple guard reads it.
      lastDesignTuple: seeded.tuple,
    };

    let tenantId: string;
    if (mode === "onboard") {
      // The spread must NOT carry generation-owned media (photos/photoMeta/
      // generatedHero): a stale copy would resurrect photos the owner removed
      // (review must-fix). The gated writes below re-add what THIS generation
      // actually has.
      const carriedBrand: Record<string, unknown> = { ...baseBrand };
      delete carriedBrand.photos;
      delete carriedBrand.photoMeta;
      delete carriedBrand.generatedHero;
      const brandPhotoMeta = siteScopedPhotoMeta(media);
      // O1 (owner audit 2026-08-10): an opaque logo asset gets a chip in its
      // OWN backdrop colour in the chrome. Measured once, here, and reused
      // while the logo URL is unchanged — a re-measure per generation would
      // put a network fetch on the preview write's critical path. Fail-open:
      // no measurement → no plate → today's rendering.
      //
      // L1 (same audit): this is also the ONE funnel where an onboarding logo
      // becomes brand data — an owner upload and an Instagram avatar both
      // arrive here as `media.logoUrl` — so the canvas adaptation is derived
      // here too. It writes a SIBLING file and never rewrites `logoUrl`.
      // `ensureAdaptedLogo` short-circuits when the mark already exists (the
      // upload route usually made it), so the steady state is one list call.
      const sameLogo = !!media?.logoUrl && carriedBrand.logoUrl === media.logoUrl;
      let logoPlate =
        sameLogo && typeof carriedBrand.logoPlate === "string" ? carriedBrand.logoPlate : undefined;
      let logoAdaptedUrl =
        sameLogo && typeof carriedBrand.logoAdaptedUrl === "string"
          ? carriedBrand.logoAdaptedUrl
          : undefined;
      let logoInkL =
        sameLogo && typeof carriedBrand.logoInkL === "number" ? carriedBrand.logoInkL : undefined;
      // Retry whenever there is no adapted mark yet — not merely when the logo
      // changed. A refusal is a judgement of the CODE, not of the asset: a tenant
      // that fell back to a plate under an older, stricter proof would otherwise
      // keep that plate forever and never see the improved one. Costs nothing in
      // the steady state (an adapted mark short-circuits to zero calls) and needs
      // no backfill — the next generation self-heals.
      if (media?.logoUrl && !logoAdaptedUrl && logoInkL === undefined) {
        const adapted = await ensureAdaptedLogo(media.logoUrl);
        logoAdaptedUrl = adapted?.url;
        // The adapted mark's own ink: masking the canvas away also removed the
        // contrast it provided, so the chrome needs to know whether what is left
        // still reads on a light nav (`resolveDisplayLogo`).
        logoInkL = adapted?.inkL;
        // Only when nothing was cut out: a plate painted behind an ADAPTED mark
        // would restore the very slab the mask removed — including a plate this
        // tenant carried in from the attempt that used to fail.
        if (logoAdaptedUrl) logoPlate = undefined;
        else {
          const measured = await measureLogoPlateFromUrl(media.logoUrl);
          if (measured && /^#[0-9a-f]{6}$/i.test(measured)) logoPlate = measured;
        }
      }
      delete carriedBrand.logoPlate;
      delete carriedBrand.logoAdaptedUrl;
      delete carriedBrand.logoInkL;
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
              ...brandSeedFields,
              ...(media?.logoUrl && { logoUrl: media.logoUrl }),
              ...(logoAdaptedUrl && { logoAdaptedUrl }),
              ...(logoInkL !== undefined && { logoInkL }),
              ...(logoPlate && { logoPlate }),
              ...(media?.photos?.length && { photos: media.photos }),
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
      tenantId = tenant.id as string;

      // DRAFT-scope upsert: published_content / is_published OMITTED — a
      // regenerate never nulls the live content (§5.5).
      const { error: pErr } = await sb.from("pages").upsert(
        {
          tenant_id: tenantId,
          slug: "",
          page_type: "home",
          title: "Головна",
          show_in_nav: false,
          nav_order: 0,
          draft_content: draftContent,
        },
        { onConflict: "tenant_id,slug" },
      );
      if (pErr) throw new Error(`page upsert failed: ${pErr.message}`);
    } else {
      tenantId = prevRow!.id as string;
      const { error: pErr } = await sb
        .from("pages")
        .update({ draft_content: draftContent })
        .eq("id", pageId!);
      if (pErr) throw new Error(`page update failed: ${pErr.message}`);
      const { error: bErr } = await sb
        .from("tenants")
        .update({ brand: { ...baseBrand, ...brandSeedFields } })
        .eq("id", tenantId);
      if (bErr) {
        // The draft is saved — losing the nonce/tuple history costs variety on
        // the NEXT run, not this one. Log, don't fail the regeneration.
        log.warn("brand seed write failed", { host, error: bErr.message });
      }
    }
    // The preview point (TFAO): the transport shows the draft NOW.
    await emit({
      stage: "s3_compile",
      status: "done",
      detail: { preview: true, sections: draftContent.blocks.length },
    });

    // Image batch — STARTED at S3, awaited by after() (live death, avtomaister-2
    // 2026-08-12). `after()` callbacks only begin once the response has been
    // sent, i.e. AFTER S4 — and on a slow-provider day the chain plus S4 ran to
    // the 300s wall, leaving the job seconds before the platform killed the
    // function. The pending gallery then sat in DRAFT AND PUBLISHED as shimmer
    // tiles forever. Starting the promise HERE runs the ~60-90s of image work
    // concurrently with S4's 150s window, so it is normally finished long
    // before the response ends; after(() => job) still guarantees the runtime
    // waits for it when it is not. The patch stays safe next to S4's writers —
    // it CASes on genToken + contentRev like every other async draft writer.
    if (needGeneratedImages) {
      const subjects = site.imageSubjects;
      const verticalIdForGen = vertical.id;
      const altBase = facts.city ? `${facts.businessName}, ${facts.city}` : facts.businessName;
      const imageJob = (async () => {
        let hero: string | null = null;
        let gallery: string[] = [];
        try {
          const gen = await generateSiteImages({
            verticalId: verticalIdForGen,
            subjects,
            galleryCount: GENERATED_GALLERY_COUNT,
            // Same nonce the design axes are seeded from: two sites in one
            // niche — and two regenerations of one site — draw a different
            // fallback order instead of the same random two.
            seed: designNonce,
          });
          hero = gen.hero;
          gallery = gen.gallery;
        } catch (e) {
          log.warn("deferred image gen failed", { host, error: e });
        }
        // ALWAYS patch — even on total failure: the pending gallery MUST be
        // resolved (real images or an empty, self-hiding gallery).
        try {
          await patchGeneratedImages({ host, hero, gallery, altBase, genToken });
        } catch (e) {
          log.warn("deferred image patch failed", { host, error: e });
        }
      })();
      after(() => imageJob);
    }

    // ── S4: QA — after the preview, on its OWN budget, clamped to what's left
    // of the request wall clock (§6: the handler must never outlive maxDuration
    // — 240s chain + a fixed 150s S4 could run to 390s against the 300s cap).
    const s4Budget = Math.min(S4_BUDGET_MS, REQUEST_WALL_MS - (Date.now() - runStart));
    // What S4 left behind: a sheet it successfully wrote, or the admission that
    // it no longer knows what is on the row.
    let qa: { wireCss?: string; unknown?: boolean } = {};
    if (s4Budget <= 0) {
      await emit({ stage: "s4_qa", status: "skipped", detail: { reason: "qa_skipped_deadline" } });
    } else {
      await emit({ stage: "s4_qa", status: "start" });
      const s4Start = Date.now();
      const s4Signal = AbortSignal.timeout(s4Budget);
      qa = await runDraftQualityLoop({
        host,
        facts,
        verticalId: vertical.id,
        media,
        templateId: site.templateId,
        dossier,
        styleBrief,
        styleHue: seeded.hue,
        styleAltHue: seeded.altHue,
        signal: s4Signal,
        // §6 table: onboard = 1 inspect round (≤2 fixes) + style audit;
        // editor = style audit only.
        textRounds: mode === "onboard" ? 1 : 0,
        maxFixesPerRound: 2,
        designSpec: draftContent.designSpec,
        briefRepairs: brief?.repairs,
        // The audited sheet is a carry-over previous sheet exactly when the
        // S2а leg produced nothing (review must-fix): the audit then skips the
        // adherence judgement — the stylist never wrote that css against this
        // brief — and marks the report for the admin chip.
        styleCarryOver: rawCss === undefined && Boolean(prevWireCss),
      // Nothing from the stylist AND nothing to carry — the site is running on
      // the deterministic floor, and S4's one regen is its only chance at a
      // real design.
      styleFellBack: rawCss === undefined && !prevWireCss,
        // S3 compile notes ride the persisted audit report (spec §9.3): the
        // audit re-lints an already clean sheet, so without these the admin
        // would see an empty log while compile stripped/truncated plenty.
        compileNotes: compiled.lintNotes.slice(0, 40),
        // Gate on the budget actually REMAINING when the audit's first verdict
        // lands (a model call itself), against what a regen needs — not a
        // head-start window that the verdict call alone always outlived.
        canRegenStyle: () => s4Budget - (Date.now() - s4Start) >= S4_REGEN_MIN_REMAINING_MS,
      });
      await emit({ stage: "s4_qa", status: "done" });
    }

    // S4 can REPLACE the sheet S3 compiled (the audit's corrective regen), so
    // the post-QA sheet wins when there is one. When S4 lost its swap it does
    // not know what the row holds — and neither do we, so we send NOTHING
    // rather than our stale S3 copy: the editor treats a missing design as
    // «re-read the page», which is the only honest answer available.
    const shippedCss = qa.unknown ? undefined : (qa.wireCss ?? draftContent.wireCss);
    return {
      ok: true,
      host,
      blocks: draftContent.blocks,
      ...(shippedCss && { wireCss: shippedCss }),
      ...(draftContent.designSpec && { designSpec: draftContent.designSpec }),
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await emit({ stage, status: "error", detail: { error: message } });
    return { ok: false, host, error: message };
  }
}

// ---------------------------------------------------------------------------
// Shared write helpers (moved from publish.ts with the pipeline).
// ---------------------------------------------------------------------------

/**
 * Purge the live site on EVERY host it answers on: a tenant moved to its paid
 * domain serves the same pages under a second cache tag. The custom domain is
 * read best-effort on purpose (ships with migration 0009) — a read failure is
 * a missing column, never a reason to fail a publish.
 */
export async function revalidateLiveHosts(
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

/**
 * Deferred-image patch: swap the shimmer placeholders for the generated URLs
 * in the DRAFT — and, if the owner published mid-flight, the LIVE copy too.
 *
 * Draft write: genToken (identity — a newer «Згенерувати ще раз» wins) AND
 * contentRev CAS (version — spec §9: a stale read must not clobber an S4/QA
 * write that landed between our read and write; the rev is taken from the
 * fresh read, so any interleaving either matches or aborts harmlessly).
 * Published copy: genToken CAS as before (published never carries contentRev).
 * Fail-open: any error is a warn, never a throw.
 */
async function patchGeneratedImages(opts: {
  host: string;
  hero: string | null;
  gallery: string[];
  altBase: string;
  genToken: string;
}): Promise<void> {
  const { host, hero, gallery, altBase, genToken } = opts;
  const sb = getServiceClient();
  const { data: tenant } = await sb.from("tenants").select("id").eq("host", host).maybeSingle();
  if (!tenant) return;

  const patchBlocks = (blocks: StoredBlock[]): StoredBlock[] =>
    blocks.map((b) => {
      if (b.type === "hero" && hero && !b.props.imageUrl) {
        return {
          ...b,
          props: { ...b.props, imageUrl: hero, imageAlt: `Атмосферне зображення — ${altBase}` },
        };
      }
      if (b.type === "gallery" && (b.props.pendingImages ?? 0) > 0) {
        // Generated images come AFTER the owner's own (§4.8: real photos are
        // never displaced). ≥2 tiles → fill; else resolve to an empty gallery,
        // which the renderer hides.
        const merged = [
          ...b.props.images,
          ...gallery.map((url, i) => ({ url, alt: `Атмосферне зображення ${i + 1} — ${altBase}` })),
        ];
        const images = merged.length >= 2 ? merged : [];
        // INVARIANT 1, on the title. The alt text says «атмосферне», but the
        // heading is what a visitor reads as the claim — and the model picks
        // that heading. Topping «Наші роботи» up with imagery nobody made for
        // this business turns a decorative tile into a lie about their work.
        // A gallery that receives generated images carries the honest heading,
        // whoever wrote the original.
        const title = gallery.length > 0 ? GENERATED_GALLERY_TITLE : b.props.title;
        return { ...b, props: { title, images } };
      }
      return b;
    });

  // READ → PATCH → CAS, retried on a lost swap (review catch). The job now
  // starts at S3 and runs BESIDE S4's writers, which bump contentRev with the
  // SAME genToken several times per run — so «stale» here usually means «S4
  // saved between my read and my write», not «a regeneration owns the row».
  // Surrendering on it permanently dropped the paid images and left the
  // shimmer tiles on the live site. Each retry re-reads and re-applies the
  // patch to the FRESH blocks (patchBlocks is a pure function of them); a
  // CHANGED genToken is still a full stop — that row belongs to a newer
  // generation, whose own job will bring its own images.
  const ATTEMPTS = 5;
  let resolved: PageContent | undefined;
  let pageId: string | undefined;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
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
    const candidate: PageContent = {
      ...draft,
      blocks: patchBlocks(draft.blocks),
      ...(hero && { generatedHero: hero }),
    };

    const cas = await casUpdateDraft(
      sb,
      { pageId: page.id as string, genToken, contentRev: readContentRev(draft) },
      candidate,
    );
    if (cas.ok) {
      resolved = candidate;
      pageId = page.id as string;
      break;
    }
    if (!cas.stale) {
      log.warn("draft image patch failed", { host, error: cas.error });
      return;
    }
    if (attempt === ATTEMPTS) {
      log.warn("draft image patch lost every swap", { host, attempts: ATTEMPTS });
      return;
    }
    // S4's writes are seconds apart, not milliseconds — give the row a moment.
    await new Promise((r) => setTimeout(r, 800 * attempt));
  }
  if (!resolved || !pageId) return;

  // 2) PUBLISHED — write the RESOLVED content gated by CAS on the published
  // token, through the same draft→published projection publish uses.
  const publishedContent = publishedFromDraft(resolved);
  const { data: pRows, error: pErr } = await sb
    .from("pages")
    .update({ published_content: publishedContent })
    .eq("id", pageId)
    .eq("published_content->>genToken", genToken)
    .select("id");
  if (pErr) {
    log.warn("published image patch failed", { host, error: pErr.message });
    return;
  }

  // Purge only when the LIVE copy actually changed (§5.5).
  if (pRows?.length) await revalidateLiveHosts(sb, tenant.id as string, host);
}
