import { blockLibrary } from "./library";
import type { BlockInstance, BlockType } from "./schema";

/**
 * Block-content hygiene — the deterministic cleanup that must run EVERY time
 * model-written block props are about to be persisted or rendered, not only at
 * generation time.
 *
 * It lives here, in a dependency-free module under lib/blocks, for one reason:
 * the generation module (lib/ai/generate.ts) drags the Anthropic SDK with it,
 * so a renderer or the S4 QA loop could not reuse the rule without pulling half
 * the pipeline in. One function, three callers (assemble, the QA rebuild, the
 * wireframe's render guard) — which is what «the registry drives render AND
 * validation» means in practice (§3 invariant 4).
 *
 * Owner feedback 2026-08-10, item 4: a live site shipped the benefits strip as
 * a visible SEO keyword row («Теніс · Tennis · Тенісльвів · Львів · Тренер з
 * тенісу», titled «Наш світ»). Keyword stuffing hurts the reader and search
 * alike, so the contract in blockLibrary/marqueeSchema says «benefit phrases»
 * and this is the code that makes the contract true.
 */

/** Any Cyrillic letter — the page is Ukrainian, so an item with none of these
 *  is an English/transliterated duplicate written «for search». */
const CYRILLIC_RE = /[Ѐ-ӿ]/;

/** Normalized key for duplicate detection: lowercase letters/digits only, so
 *  «Теніс», «теніс!» and «Теніс —» collapse to one. */
function benefitKey(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Clean a benefit strip: drop keyword-shaped items, then decide whether what
 * remains is still a section. Returns the kept items — an empty array means
 * «this was a tag cloud, not a benefits row» and the item floor drops the block.
 *
 * An item is keyword-shaped when it is:
 *  - a hashtag («#теніс») — social tagging, never a benefit;
 *  - script-foreign («Tennis», «Tennis coach») — a latin/translit duplicate;
 *  - a single word that carries the city («Львів», «Тенісльвів», «Львівтеніс»)
 *    — location belongs in prose and metadata, not in chips;
 *  - a single word that another item already contains (the classic
 *    «Теніс» + «Тенісльвів» stuffing pair, in either direction);
 *  - a repeat of an item already kept.
 *
 * Two block-level verdicts drop the strip whole rather than half-clean it:
 *  - EVERY survivor is a bare single word — a row of nouns with no benefit in
 *    them is a tag cloud whatever the words are. The verdict deliberately does
 *    NOT fire on a mixed row: Ukrainian benefits are frequently one word
 *    («Абонементи», «Групи») and an honest row that happens to be half short
 *    nouns is the cheapest substance a data-poor page has — the earlier
 *    «half or more are bare» rule deleted exactly that;
 *  - the removed items OUTNUMBER the survivors — the section was CONCEIVED as a
 *    keyword strip, and a leftover query-shaped phrase («Тренер з тенісу»)
 *    standing among two benefits still reads as stuffing. A benefits row is a
 *    nice-to-have; visible keyword chips actively hurt readers and search — so
 *    the tie-break goes to dropping.
 */
export function cleanBenefitStrip(items: readonly string[], city?: string): string[] {
  const trimmed = items.map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean);
  const cityKey = benefitKey(city ?? "");
  const keys = trimmed.map(benefitKey);
  const kept: string[] = [];
  const keptKeys = new Set<string>();

  for (let i = 0; i < trimmed.length; i++) {
    const item = trimmed[i];
    const key = keys[i];
    if (!key || keptKeys.has(key)) continue;
    if (item.startsWith("#")) continue;
    if (!CYRILLIC_RE.test(item)) continue;
    const single = wordCount(item) === 1;
    if (single && cityKey.length >= 4 && key.includes(cityKey)) continue;
    if (
      single &&
      keys.some((other, j) => j !== i && other.length > 2 && (key.includes(other) || other.includes(key)))
    ) {
      continue;
    }
    kept.push(item);
    keptKeys.add(key);
  }

  if (kept.length === 0) return [];
  if (kept.length >= 3 && kept.every((s) => wordCount(s) === 1)) return [];
  if (trimmed.length - kept.length > kept.length) return [];
  return kept;
}

/** Section title fallback for a surviving benefit strip: «Наш світ» over a row
 *  of chips was half the owner's complaint. A titleless strip reads as an
 *  orphan band, so code supplies an honest, business-agnostic heading — the
 *  same force-injection pattern as the lead form's copy. */
export const BENEFITS_TITLE = "Чому обирають нас";

// ---------------------------------------------------------------------------
// Item floors for list/grid sections (owner feedback 2026-08-10, item 5: «Наша
// тренерка» rendered a card GRID holding exactly ONE card). The numbers and the
// below-floor policy live in blockLibrary — one table, read by the prompt doc
// AND by this enforcement — and the check lives here so EVERY writer of block
// props can apply it (assemble, the S4 QA rebuild), not just generation.
// ---------------------------------------------------------------------------

export function itemCountOf(b: BlockInstance): number | undefined {
  switch (b.type) {
    case "services":
    case "testimonials":
    case "team":
    case "timeline":
    case "publications":
    case "stats":
    case "faq":
    case "marquee":
      return b.props.items.length;
    default:
      return undefined;
  }
}

/**
 * Does this block clear its section's item floor? Only `belowMin: "drop"` types
 * can fail — a `"keep"` type (services/team/testimonials) always passes here,
 * because its thin content is genuine and the LAYOUT adapts instead. Exported
 * for vitest.
 */
export function meetsItemFloor(type: BlockType, count: number | undefined): boolean {
  const entry = blockLibrary[type];
  if (!entry.minItems || entry.belowMin !== "drop") return true;
  return count === undefined || count >= entry.minItems;
}
