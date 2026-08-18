import type { StoredBlock } from "@/lib/blocks/schema";
import type { DesignSpec } from "@/lib/site/design-spec";
import type { PageSeo } from "@/lib/tenant/types";

/** Result of the style QA gate (css-lint + contrast + model verdict). Draft-only:
 *  diagnostics for the editor/admin, never published. */
export interface StyleAuditReport {
  /** Human-readable notes for every stripped declaration/at-rule. */
  lintViolations: string[];
  /** Human-readable notes for every contrast auto-fix. */
  contrastFixes: string[];
  verdict: "pass" | "fail";
  /** Ukrainian corrective note from the model verdict (present on fail). */
  correctiveNote?: string;
  /** True when the gate spent its one stylesheet regeneration. */
  regenerated: boolean;
  /** Final fail after the regen budget, OR a code-proven unresolved contrast
   *  pair (see contrastFixes) — surfaces in the admin QA column. */
  flagged: boolean;
  /** S4 brief-adherence judgement (pipeline v2 §3-S4): does the shipped sheet
   *  respect the designSpec's palette roles / typography character / motion
   *  level? Present only when the generation carried a designSpec. Advisory —
   *  never flips `verdict`/`flagged` — and by prompt contract tolerant of
   *  legitimate deterministic repairs (fixContrast may move colors). */
  adherence?: { palette: boolean; typography: boolean; motion: boolean; note?: string };
  /** True when the audited sheet was NOT produced by this generation — the
   *  S2а style leg failed and the PREVIOUS tenant sheet was carried over
   *  (pipeline-compile fallback). Adherence is suppressed then: judging a
   *  sheet the stylist never wrote against the NEW brief would report a brief
   *  violation that never happened. Cleared when the audit's corrective regen
   *  replaced the sheet with one generated against this run's spec. The admin
   *  chip reads «попереднє оформлення» off this flag. */
  carriedOver?: boolean;
  /** The audited sheet is the code-written FALLBACK (`buildFallbackWireCss`) —
   *  the style leg produced nothing and there was no previous sheet to carry.
   *  The site IS styled, but by a floor rather than by a stylist: adherence is
   *  meaningless against it, the report is flagged so the admin column says so,
   *  and the audit spends its one regen trying to replace it. */
  fellBack?: boolean;
  /** Honest log of every code-side repair validateDesignSpec applied to the S1
   *  brief (pipeline v2 §3) — rides the audit so the admin surface sees it. */
  briefRepairs?: string[];
  /** S3 compile notes (lint-before-persist strips + the 60k size clamp, spec
   *  §9.3) — carried into the report because the audit re-lints an already
   *  clean sheet and would otherwise show an empty log while compile stripped
   *  plenty. A size truncation MUST appear here, never pass silently. */
  compileNotes?: string[];
  checkedAt: string;
}

/**
 * The shape stored in `pages.draft_content` / `pages.published_content`.
 *
 * Several code paths rewrite a page's content — generation, the quality loop,
 * the deferred image job, publish. Each one used to rebuild the object field by
 * field, and each new field had to be remembered in every one of them. It never
 * was: `templateId`/`wireCss` were dropped by the quality loop and by the image
 * job, which left published sites rendering blocks with no design at all.
 *
 * So: writers spread what they read and override only what they changed, and
 * the draft→published direction goes through `publishedFromDraft` below. A new
 * field needs exactly ONE decision here: does it publish (nothing to do) or is
 * it draft-only (add its key to DRAFT_ONLY)?
 */
export interface PageContent {
  blocks: StoredBlock[];
  /** Blocks the owner removed or an earlier generation produced. Editor-only —
   *  never published (it would double every section on the live site). */
  pocket?: StoredBlock[];
  seo?: PageSeo;
  /** The wireframe these blocks were composed against, and the stylesheet the
   *  model wrote for them. Versioned WITH the content so a draft regeneration
   *  cannot restyle the live site (invariant 6). */
  templateId?: string;
  wireCss?: string;
  /** Per-generation token — the deferred image job's CAS key. */
  genToken?: string;
  generatedHero?: string;
  /** Style QA gate report — editor/admin diagnostics only (see StyleAuditReport). */
  styleAudit?: StyleAuditReport;
  /** The S1 design brief this content was generated against (pipeline v2 §3).
   *  PUBLISHES with the content: the renderer reads typography/motion from it,
   *  so the live site and the draft each carry their own. */
  designSpec?: DesignSpec;
  /** The model's reasoning for the brief — editor/admin diagnostics, never
   *  published (spec §3: a top-level key BECAUSE DRAFT_ONLY strips only
   *  top-level keys; nested inside designSpec it would publish). */
  designRationale?: string;
  /** Monotonic draft revision — the CAS key for EVERY async writer of the
   *  DRAFT copy (QA blocks/style, S4 patches, image-job draft patch; spec §9).
   *  Draft-only: published-copy patches keep the genToken CAS. Pre-v2 rows
   *  lack it — writers CAS with coalesce(…, 0). */
  contentRev?: number;
}

/** Keys that exist only in a draft and must never reach the live site. */
const DRAFT_ONLY = [
  "pocket",
  "styleAudit",
  "designRationale",
  "contentRev",
] as const satisfies readonly (keyof PageContent)[];

/**
 * The published copy of a draft: everything the draft carries except the
 * editor-only keys. Additive by construction — a field added to PageContent
 * reaches the live site without touching any publish path.
 */
export function publishedFromDraft(draft: PageContent): PageContent {
  const out: PageContent = { ...draft };
  for (const key of DRAFT_ONLY) delete out[key];
  // Gallery shimmer placeholders are a DRAFT affordance: the deferred image
  // job resolves them in the draft and re-projects the published copy itself
  // (with a purge), so the live site gains the tiles the moment they exist.
  // Publishing them raw exposed the one failure the job cannot repair — an
  // after() callback killed by the platform (2026-08-13 API incident) left
  // PERMANENT empty tiles on live sites. The live site never shows «coming
  // soon» boxes; the editor keeps them. And a pending gallery left with
  // fewer than assemble's ≥2-image floor is dropped WHOLE — otherwise the
  // force-injected {«Наша атмосфера», images: []} publishes as a bare
  // heading over an empty grid (pre-deploy review 2026-08-18). The job's own
  // re-projection restores the block once real images exist.
  if (Array.isArray(out.blocks)) {
    out.blocks = out.blocks.flatMap((b): StoredBlock[] => {
      if (b.type !== "gallery") return [b];
      const props = b.props as { pendingImages?: number; images?: unknown[] };
      if (!props.pendingImages) return [b];
      const rest = { ...props };
      delete rest.pendingImages;
      if ((rest.images?.length ?? 0) < 2) return [];
      return [{ ...b, props: rest } as typeof b];
    });
  }
  return out;
}
