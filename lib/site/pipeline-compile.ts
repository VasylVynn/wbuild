import { lintWireCss } from "@/lib/design/css-lint";
import { fixContrast } from "@/lib/design/css-contrast";
import type { SiteTemplate } from "@/lib/templates/registry";
import type { ShippedSection } from "@/lib/ai/generate";
import type { DesignBriefResult } from "@/lib/ai/design-brief";
import type { StoredBlock } from "@/lib/blocks/schema";
import type { DesignSpec, SectionPlanEntry } from "@/lib/site/design-spec";
import type { PageContent } from "@/lib/site/page-content";
import { readContentRev } from "@/lib/site/draft-cas";

/**
 * The deterministic S3 pieces of pipeline v2 (spec §3-S3, §8, §9) — pure, so
 * the write contract is vitest-provable without the pipeline's server import
 * graph. `lib/site/pipeline.ts` re-exports everything here; nothing else
 * should import this module directly.
 */

export type PipelineMode = "onboard" | "editor";

/**
 * Compile the raw model stylesheet for persistence: lint + deterministic
 * contrast repair run BEFORE the first draft write (spec §3-S3 — the old flow
 * persisted the raw sheet and relied on a fail-open QA loop to lint it, so an
 * early-return left `url()` holes live). No raw sheet → the previous tenant's
 * stored sheet (existing tenants only; a first generation degrades to the grey
 * wireframe, honestly).
 */
export function compileWireCss(
  rawCss: string | undefined,
  prevWireCss: string | undefined,
): { wireCss?: string; lintNotes: string[] } {
  if (!rawCss) return { ...(prevWireCss !== undefined && { wireCss: prevWireCss }), lintNotes: [] };
  const lint = lintWireCss(rawCss);
  const contrast = fixContrast(lint.cleanCss);
  return { wireCss: contrast.css, lintNotes: [...lint.violations, ...contrast.fixes] };
}

/**
 * Block types the S1 section plan implies, in page order — the style brief's
 * section line for the PARALLEL S2а leg, which can no longer read the finished
 * composition (v1 ran the two calls sequentially). lead_form/contacts are
 * appended: code always injects them (invariant 8).
 */
export function planBlockTypes(
  plan: readonly SectionPlanEntry[],
  template: SiteTemplate | undefined,
): string[] {
  const types: string[] = [];
  if (template) {
    for (const entry of plan) {
      const block = template.sections[entry.section]?.block;
      if (block) types.push(block);
    }
  }
  types.push("lead_form", "contacts");
  return types;
}

export interface DraftBuildInput {
  mode: PipelineMode;
  /** The draft read at pipeline start — editor mode SPREADS it (§8). */
  oldDraft?: PageContent;
  blocks: StoredBlock[];
  templateId: string;
  seo?: { title?: string; description?: string };
  /** Already compiled (linted) — see compileWireCss. */
  wireCss?: string;
  /** S1 result; null/absent → the v1 path (no designSpec persisted, and a
   *  STALE spec from a previous run is cleared — it described another
   *  composition and another stylesheet). */
  brief?: DesignBriefResult | null;
  /** Post-assembly truth from generateSite — reconcile overwrites the plan
   *  with it so S4 never punishes legitimate plan/assembly divergence. */
  shippedPlan: ShippedSection[];
  genToken: string;
  /** Editor mode: the hero carried from oldDraft/brand (§8: «з oldDraft»). */
  generatedHero?: string;
}

/**
 * The §8 write contract, one field at a time:
 *
 * | field         | onboard                    | editor                        |
 * |---------------|----------------------------|-------------------------------|
 * | pocket        | [] (fresh page)            | accumulates old blocks (-40)  |
 * | genToken      | minted                     | minted too (closes the stale  |
 * |               |                            | image-job hole)               |
 * | generatedHero | rides `brand` (from media) | rides draft (from oldDraft)   |
 * | draft_content | fresh object               | SPREAD of oldDraft            |
 * | contentRev    | old+1                      | old+1                         |
 *
 * Editor spreads what it read so unknown/future draft keys survive; onboard is
 * a fresh page by definition. Both clear styleAudit (it described the previous
 * stylesheet) — S4 writes the new report via CAS.
 */
export function buildDraftContent(input: DraftBuildInput): PageContent {
  const { mode, oldDraft, blocks, templateId, seo, wireCss, brief, shippedPlan, genToken } = input;
  const contentRev = readContentRev(oldDraft) + 1;
  // Reconcile (spec §3-S3): the persisted plan is the POST-injection truth.
  // shippedPlan is never empty in practice (lead_form + contacts always ship),
  // but the belt keeps the schema's min(1) honest.
  const designSpec: DesignSpec | undefined = brief
    ? {
        ...brief.spec,
        sectionPlan: shippedPlan.length
          ? (shippedPlan as SectionPlanEntry[])
          : brief.spec.sectionPlan,
      }
    : undefined;

  if (mode === "onboard") {
    return {
      blocks,
      pocket: [],
      genToken,
      templateId,
      ...(wireCss !== undefined && { wireCss }),
      ...(seo && { seo }),
      ...(designSpec && { designSpec }),
      ...(brief?.rationale && { designRationale: brief.rationale }),
      contentRev,
    };
  }

  const old = oldDraft ?? { blocks: [] };
  return {
    ...old,
    blocks,
    // The owner's previous composition is never deleted, only pocketed (§4.7).
    pocket: [...(old.pocket ?? []), ...(old.blocks ?? [])].slice(-40),
    genToken,
    templateId,
    // Resolved upstream: freshly compiled sheet, else the old one. An explicit
    // undefined only happens when neither exists (grey wireframe).
    wireCss,
    // Regeneration mints fresh SEO; the previous meta survives only when the
    // model returned none (current editor behavior, kept).
    seo: seo ?? old.seo,
    generatedHero: input.generatedHero,
    // The audit described the PREVIOUS sheet — S4 writes the new one (CAS'd).
    styleAudit: undefined,
    designSpec,
    designRationale: brief?.rationale,
    contentRev,
  };
}
