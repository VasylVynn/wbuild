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

// ---------------------------------------------------------------------------
// Contact-value hygiene (live audit 2026-08-10, owner items 8 + 10). A URL is
// machine output, never copy. The tennis site printed
// «@https://www.instagram.com/san.team.tennis» as body text because a fact that
// MEANS a handle was stored as a full profile URL and interpolated raw — and at
// 390px that 451px unbreakable token was the ONE element that scrolled the
// whole document sideways.
//
// contact-links.ts owns the IDENTITY fields (instagram/telegram): it turns them
// into one canonical handle. This owns everything else — the prose fields a
// model can drop a link into (title, subtitle, body, item text, alt) — because
// the rule is not «fix instagram_cta», it is «no user-visible string on a
// generated site is ever a URL».
// ---------------------------------------------------------------------------

/**
 * Keys whose value IS a machine address by contract and must be left alone:
 * storage image URLs (invariant 1 — mangling one deletes a real photo), deep
 * links, identity handles, map queries and ids. Matched by NAME, as a pattern
 * rather than a fixed list, so a block field added later defaults to SAFE
 * (untouched) instead of silently getting its URL scrubbed.
 */
const URL_VALUED_KEY_RE =
  /(^|[a-z])(url|urls|href|src|image|images|photo|photos|logo|icon|avatar|handle|instagram|telegram|viber|phone|email|query|id|ids)$/i;

/**
 * A link inside visible prose. Two arms:
 *  - an explicit scheme or `www.` prefix — unambiguous;
 *  - a bare `host.tld/path` («t.me/SanTeamTennis», «instagram.com/x») — the
 *    PATH is what makes it a link rather than a name, which is why a bare
 *    «Auto.ua» or a business called «Ромашка.укр» survives, and why «10.00»
 *    and «вул. Січових» cannot match (the TLD arm is ASCII letters only).
 */
const VISIBLE_URL_RE =
  /(?:https?:\/\/|www\.)\S+|[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,10}\/\S*/gi;

/**
 * Remove links from one visible string and tidy what they leave behind
 * (emptied brackets, doubled spaces, a dangling separator or colon). Returns
 * the input untouched when it holds no link, so the common path allocates
 * nothing new.
 */
export function stripBareUrls(text: string): string {
  if (!text) return text;
  const stripped = text.replace(VISIBLE_URL_RE, " ");
  if (stripped === text) return text;
  return stripped
    .replace(/\(\s*\)|\[\s*\]|«\s*»/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,.;:·•|–—-]+/, "")
    .replace(/[\s,;:·•|–—-]+$/, "")
    .trim();
}

function scrubValue(key: string, value: unknown): unknown {
  if (typeof value === "string") {
    if (URL_VALUED_KEY_RE.test(key)) return value;
    const cleaned = stripBareUrls(value);
    // A field that was NOTHING BUT a link keeps its original value on purpose.
    // Emptying it here would push an empty string through validateBlocks and
    // delete the whole block; that is a CONTENT failure for S4 QA to see, not a
    // formatting one for this pass to paper over.
    return cleaned || value;
  }
  if (Array.isArray(value)) return value.map((v) => scrubValue(key, v));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, scrubValue(k, v)]),
    );
  }
  return value;
}

/** Apply {@link stripBareUrls} to every visible string prop of a block. */
export function scrubVisibleUrls<T extends BlockInstance>(block: T): T {
  return { ...block, props: scrubValue("props", block.props) } as T;
}

// ---------------------------------------------------------------------------
// Follower count display. Lives here rather than in a renderer because the
// FLOOR is a content judgement, not a style one, and all five templates that
// print a follower number must agree on it.
// ---------------------------------------------------------------------------

/**
 * Below this, the number is not social proof — it is anti-proof. «12
 * підписників» under a «Написати в Direct» button actively argues against
 * clicking it, so the count simply does not render and the button stands alone.
 */
export const FOLLOWERS_DISPLAY_MIN = 300;

/**
 * «1 підписник / 2 підписники / 5 підписників» — Ukrainian plural forms, with
 * the thousands grouped by a NO-BREAK space (U+00A0) so «12 400 підписників»
 * can never break across a line mid-number. Grouping is done here rather than
 * via toLocaleString so the output is identical in every runtime and in vitest,
 * ICU build regardless.
 */
export function formatFollowers(n: number): string {
  const count = String(Math.trunc(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} підписник`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} підписники`;
  return `${count} підписників`;
}

/** The follower line to render, or null when there is none worth printing. */
export function displayFollowers(n: number | undefined | null): string | null {
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  if (n < FOLLOWERS_DISPLAY_MIN) return null;
  return formatFollowers(n);
}
