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
  /** Honest log of every code-side repair validateDesignSpec applied to the S1
   *  brief (pipeline v2 §3) — rides the audit so the admin surface sees it. */
  briefRepairs?: string[];
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
  return out;
}
