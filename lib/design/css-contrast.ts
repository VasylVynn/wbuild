import "server-only";
import postcss, { type Rule } from "postcss";
import { parse as parseColor, formatHex, wcagContrast, converter, type Oklch } from "culori";

/**
 * Static WCAG contrast check over the generated sheet. A browser would resolve
 * the cascade for us; without one we exploit the fact that the wireframe is
 * SINGULAR and ours: a hand-kept map of structural text↔surface pairs (below)
 * approximates "which text sits on which background". Below 4.5:1 the TEXT
 * color's OKLCH lightness is pushed away from the background until the ratio
 * passes — a single-declaration rewrite, never a palette change (spec §2).
 * Lightness moves first and chroma is preserved; see `repairTextColor` for why
 * the repair no longer snaps to black.
 *
 * Color resolution reads the base state only (no :hover/:focus/:active/:before/:after);
 * class matching respects word boundaries (`.wire-hero` does not match `.wire-hero__inner`).
 *
 * Shared declarations (e.g., `.wire-title` in multiple sections) are re-checked after
 * each pass until fixpoint (all pairs ≥4.5:1 or all passes applied zero fixes). Unresolved
 * pairs after 3 passes are reported honestly in the `fixes` array; the CSS never silently
 * fails a pair.
 *
 * Known limits (accepted, v1): pairs the map doesn't list aren't checked;
 * background-image patterns skip the pair (unknowable statically); keyword
 * non-colors (`transparent`, `currentcolor`, …) skip it too — what sits under a
 * transparent surface is unknowable without a browser, and guessing it black is
 * how text got "repaired" into invisibility; gradients are checked against their
 * WORST color stop; multi-pass fixpoint may not converge — most often because two
 * pairs share one declaration and each pass's fix for one re-breaks the other
 * (oscillation) — reported honestly as "unresolved".
 */
export interface ContrastResult {
  css: string;
  fixes: string[];
}

/** Structural pairs from components/templates/salonwire/sections.tsx (nav and
 *  footer classes live in SalonWireWrapper.tsx). sameElement pairs read
 *  color+background off one selector (buttons). Exported for the maintenance
 *  test (css-contrast-pairs.test.ts) that keeps this hand-kept map honest
 *  against the wireframe markup — every class here must still exist there,
 *  and every NEW variant-modifier class there must land here or in
 *  PAIRS_EXEMPT below. */
export const PAIRS: readonly { text: string; surface: string; sameElement?: boolean }[] = [
  { text: ".wire-title", surface: ".wire-hero" },
  { text: ".wire-subtitle", surface: ".wire-hero" },
  { text: ".wire-eyebrow", surface: ".wire-hero" },
  { text: ".wire-title", surface: ".wire-section" },
  { text: ".wire-text", surface: ".wire-section" },
  { text: ".wire-heading", surface: ".wire-card" },
  { text: ".wire-text", surface: ".wire-card" },
  { text: ".wire-price", surface: ".wire-card" },
  { text: ".wire-btn--primary", surface: ".wire-btn--primary", sameElement: true },
  { text: ".wire-footer", surface: ".wire-footer", sameElement: true },
  // V3 variant relationships (wireframe session), paired on VARIANT-LOCAL
  // hooks — never on .wire-title/.wire-subtitle/.wire-heading themselves.
  // fixContrast is variant-blind and findLast resolves a text class to its ONE
  // color declaration in the sheet, so pairing a shared text class against a
  // SECOND surface (card vs section — exactly the axis the stylist prompt
  // tells the model to differentiate) makes the shared declaration oscillate
  // across fixpoint passes on every site, whether or not the variant renders.
  // The hooks below exist only where the variant relationship is real: a sheet
  // that declares no color on them makes the pair "not computable" and it
  // silently skips (correct fail-open).
  //  - cta centered-card puts the section title/subtitle inside a card
  //    (.wire-cta__title / .wire-cta__subtitle in sections.tsx);
  //  - testimonials big-quote sets the lead author line straight on the
  //    section surface (.wire-quote__author wraps its .wire-heading).
  { text: ".wire-cta__title", surface: ".wire-card" },
  { text: ".wire-cta__subtitle", surface: ".wire-card" },
  { text: ".wire-quote__author", surface: ".wire-section" },
];

/**
 * Variant-modifier classes (`wire-<section>--<variant>`) deliberately NOT
 * carried by PAIRS. Every entry needs a one-line WHY — «couldn't be bothered»
 * is not a reason; the maintenance test fails any modifier class that is
 * neither paired nor exempted, which is how the manual PAIRS coupling stays
 * honest as the wireframe session adds variants. Prefer a real PAIRS entry
 * whenever the variant introduces its own text-on-surface relationship.
 */
export const PAIRS_EXEMPT: ReadonlySet<string> = new Set([
  // Same grid and surfaces as the base hero, photo column mirrored — the base
  // .wire-hero pairs cover its text verbatim.
  "wire-hero--mirror",
  // Text sits over a photo backdrop (an <img>, not a CSS color) — statically
  // unknowable, exactly the case fixContrast skips url() backgrounds for.
  "wire-hero--banner",
  // The scrim's dark-overlay/light-text contract is wire.css's own locked
  // rules (`.wire-hero--scrim .wire-title` etc.), not model-writable surface.
  "wire-hero--scrim",
  // Rows are still .wire-card with .wire-heading/.wire-text/.wire-price on
  // them — the base card pairs cover the text verbatim; only the flow changes.
  "wire-services--list-rows",
  // Same card text pairs as the grid; the added photo is an <img>, exactly
  // the statically-unknowable case fixContrast skips url() backgrounds for.
  "wire-services--cards-with-photo",
  // Photo tiles; captions are .wire-text on the .wire-section surface, which
  // the base (.wire-text, .wire-section) pair already carries.
  "wire-gallery--masonry-2col",
  // Same as masonry: photos + .wire-text captions on the section surface.
  "wire-gallery--stream",
  // The lead quote is .wire-text on .wire-section (base pair) and its author
  // line is the variant-local (.wire-quote__author, .wire-section) pair above.
  "wire-testimonials--big-quote",
  // The same .wire-card quote cards as the grid, in a horizontal strip.
  "wire-testimonials--strip",
  // Carried by the variant-local (.wire-cta__title/.wire-cta__subtitle,
  // .wire-card) pairs above; the button is the sameElement .wire-btn--primary
  // pair.
  "wire-cta--centered-card",
  // Same band text-on-section surfaces as the base cta; only the container
  // cap and the row flow change.
  "wire-cta--full-bleed",
  // The same .wire-card step cards as the stacked list, re-gridded; the big
  // index is covered by the card pairs' surface.
  "wire-process--numbered-cards",
  // Nav ink/surface is untouched — the variant only re-places brand/links/CTA
  // (the base nav carries no pairs either; its chrome is wire.css's own).
  "wire-nav--centered-brand",
  // Column count only; the sameElement .wire-footer pair carries the footer.
  "wire-footer--2col",
  // Column count only; the sameElement .wire-footer pair carries the footer.
  "wire-footer--single",
]);

const MIN_RATIO = 4.5;
const toOklch = converter("oklch");

/** Boundary-aware class matching: matches whole word only, not as substring. */
function hasClass(selector: string, cls: string): boolean {
  const escaped = cls.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");
  return new RegExp(escaped + "(?![\\w-])").test(selector);
}

/**
 * Keywords culori happily parses but which carry NO colour of their own.
 * `transparent` is the dangerous one: culori reads it as rgba(0,0,0,0), so a
 * `background: transparent` used to be judged as BLACK and the text on it got
 * "repaired" towards white — invisible on the real (light) surface underneath.
 * A pair whose colour we can't know statically must be skipped, not guessed.
 */
const NON_COLOR_KEYWORDS = new Set([
  "transparent",
  "currentcolor",
  "inherit",
  "initial",
  "unset",
  "revert",
  "revert-layer",
  "none",
]);

/** Every parseable color token in a value (covers gradients stop-by-stop). */
function colorTokens(value: string): string[] {
  const tokens = value.match(/#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|hwb|color)\([^)]*\)|\b[a-z]{3,20}\b/gi) ?? [];
  return tokens.filter(
    (t) => !NON_COLOR_KEYWORDS.has(t.toLowerCase()) && parseColor(t) !== undefined,
  );
}

/** Chroma budget, spent only when lightness alone can't reach 4.5:1. */
const CHROMA_STEPS = [1, 0.75, 0.5, 0.25, 0];

/**
 * Move a text colour until it clears 4.5:1, spending as little of its chroma as
 * possible.
 *
 * The old repair snapped to pure black or white the moment a lightness sweep
 * fell short, which cost the sheet its palette: a warm rose heading became
 * #000000 and the whole design read as a template with an accident in it.
 * Lightness is a free variable — it is what actually buys contrast — so the
 * full lightness range is tried at FULL chroma first, and chroma is given away
 * in steps only if that whole range fails. Grey is the last thing tried.
 *
 * Ratios are measured on the serialized hex, not the OKLCH object: a colour
 * outside sRGB is clipped when written, and the clipped colour is what the
 * visitor sees — scoring the unclipped one would report contrast that isn't there.
 */
function repairTextColor(text: Oklch, bg: string, bgL: number): { hex: string; ratio: number } {
  const chroma = text.c;
  const step = bgL > 0.5 ? -0.05 : 0.05; // away from the background
  for (const factor of CHROMA_STEPS) {
    const candidate: Oklch = { ...text, c: chroma * factor };
    for (let i = 0; i <= 20; i++) {
      const hex = formatHex(candidate);
      const ratio = wcagContrast(hex, bg);
      if (ratio >= MIN_RATIO) return { hex, ratio };
      candidate.l = Math.min(1, Math.max(0, candidate.l + step));
    }
  }
  // Nothing on this hue works against this background — pure ink or paper.
  const hex = bgL > 0.5 ? "#000000" : "#ffffff";
  return { hex, ratio: wcagContrast(hex, bg) };
}

interface Hit { rule: Rule; declIndex: number; value: string }

/** Last declaration of `props` in rules mentioning `cls` — later wins, and a
 *  rule that ALSO mentions `context` (section-scoped override) wins over one
 *  that doesn't. Crude cascade, right for .tpl-salonwire-scoped sheets. Base
 *  state only (no :hover/:focus/:active or pseudo-elements). */
function findLast(root: postcss.Root, cls: string, props: string[], context?: string): Hit | undefined {
  let hit: Hit | undefined;
  let hitHasContext = false;
  root.walkRules((rule) => {
    if (!hasClass(rule.selector, cls)) return;
    if (rule.selector.includes(":")) return; // Skip pseudo-classes and pseudo-elements
    const ruleHasContext = Boolean(context && context !== cls && hasClass(rule.selector, context));
    rule.nodes?.forEach((node, i) => {
      if (node.type !== "decl" || !props.includes(node.prop.toLowerCase())) return;
      if (hitHasContext && !ruleHasContext) return; // scoped hit already found
      hit = { rule, declIndex: i, value: node.value };
      hitHasContext = ruleHasContext;
    });
  });
  return hit;
}

export function fixContrast(css: string): ContrastResult {
  const fixes: string[] = [];
  let root;
  try {
    root = postcss.parse(css);
  } catch {
    return { css, fixes }; // lint already reported unparseable — fail-open
  }

  // Fixpoint loop: repeat until zero fixes applied or max 3 passes.
  for (let pass = 0; pass < 3; pass++) {
    let passApplied = 0;

    for (const pair of PAIRS) {
      const textHit = findLast(root, pair.text, ["color"], pair.sameElement ? undefined : pair.surface);
      const bgHit = findLast(root, pair.surface, ["background-color", "background"]);
      if (!textHit || !bgHit) continue;
      if (/url\(/i.test(bgHit.value)) continue; // pattern background — unknowable

      const textColorToken = colorTokens(textHit.value)[0];
      if (!textColorToken) continue;
      const textColor = parseColor(textColorToken);
      if (!textColor) continue;

      const bgTokens = colorTokens(bgHit.value);
      if (bgTokens.length === 0) continue;

      // Worst stop governs (gradient-safe; single color = one token).
      let worst = bgTokens[0];
      let worstRatio = Infinity;
      for (const t of bgTokens) {
        const r = wcagContrast(textColor, t);
        if (r < worstRatio) { worstRatio = r; worst = t; }
      }
      if (worstRatio >= MIN_RATIO) continue;

      const bg = parseColor(worst);
      if (!bg) continue;
      const bgOklch = toOklch(bg);
      if (!bgOklch) continue;
      const bgL = bgOklch.l;

      const textOklch = toOklch(textColor);
      if (!textOklch) continue;

      const { hex: newHex, ratio: newRatio } = repairTextColor(textOklch, worst, bgL);
      const decl = textHit.rule.nodes?.[textHit.declIndex];
      if (decl?.type !== "decl") continue;

      // Check if this would change the value (only apply if different).
      if (decl.value.toLowerCase() === newHex.toLowerCase()) continue;

      fixes.push(
        `contrast ${pair.text} on ${pair.surface} in "${textHit.rule.selector}": ` +
          `${worstRatio.toFixed(1)}:1 → ${newRatio.toFixed(1)}:1 (${decl.value} → ${newHex})`,
      );
      decl.value = newHex;
      passApplied++;
    }

    // If this pass applied zero fixes, we're done.
    if (passApplied === 0) break;
  }

  // Final check pass: honest reporting of any remaining unresolved pairs, and
  // of pairs that were never computable at all (see skipped-pairs note below).
  let computed = 0;
  for (const pair of PAIRS) {
    const textHit = findLast(root, pair.text, ["color"], pair.sameElement ? undefined : pair.surface);
    const bgHit = findLast(root, pair.surface, ["background-color", "background"]);
    if (!textHit || !bgHit) continue;
    if (/url\(/i.test(bgHit.value)) continue;

    const textColorToken = colorTokens(textHit.value)[0];
    if (!textColorToken) continue;
    const textColor = parseColor(textColorToken);
    if (!textColor) continue;

    const bgTokens = colorTokens(bgHit.value);
    if (bgTokens.length === 0) continue;
    computed++;

    let worstRatio = Infinity;
    for (const t of bgTokens) {
      const r = wcagContrast(textColor, t);
      if (r < worstRatio) worstRatio = r;
    }

    if (worstRatio < MIN_RATIO) {
      fixes.push(
        `unresolved: ${pair.text} on ${pair.surface} ${worstRatio.toFixed(1)}:1 (shared declaration conflict)`,
      );
    }
  }

  // Honesty stub (deferred: full var() resolution is a follow-up task): most
  // real sheets set colors via CSS custom properties (var(--wire-ink) etc.),
  // which colorTokens can't resolve, so those pairs silently skip above — an
  // empty `fixes` would otherwise be indistinguishable from "nothing to fix".
  const skipped = PAIRS.length - computed;
  if (skipped > 0) {
    fixes.push(`skipped: ${skipped} of ${PAIRS.length} pairs not computable (var() indirection or missing declarations)`);
  }

  return { css: root.toString(), fixes };
}
