import "server-only";
import postcss, { type Rule } from "postcss";
import { parse as parseColor, formatHex, wcagContrast, converter } from "culori";

/**
 * Static WCAG contrast check over the generated sheet. A browser would resolve
 * the cascade for us; without one we exploit the fact that the wireframe is
 * SINGULAR and ours: a hand-kept map of structural text↔surface pairs (below)
 * approximates "which text sits on which background". Below 4.5:1 the TEXT
 * color's OKLCH lightness is pushed away from the background until the ratio
 * passes — a single-declaration rewrite, never a palette change (spec §2).
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
 * background-image patterns skip the pair (unknowable statically); gradients
 * are checked against their WORST color stop; multi-pass fixpoint may not converge
 * if chroma bounds are reached before 4.5:1 on all pairs (reported as "unresolved").
 */
export interface ContrastResult {
  css: string;
  fixes: string[];
}

/** Structural pairs from components/templates/salonwire/sections.tsx. sameElement
 *  pairs read color+background off one selector (buttons). */
const PAIRS: { text: string; surface: string; sameElement?: boolean }[] = [
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
];

const MIN_RATIO = 4.5;
const toOklch = converter("oklch");

/** Boundary-aware class matching: matches whole word only, not as substring. */
function hasClass(selector: string, cls: string): boolean {
  const escaped = cls.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");
  return new RegExp(escaped + "(?![\\w-])").test(selector);
}

/** Every parseable color token in a value (covers gradients stop-by-stop). */
function colorTokens(value: string): string[] {
  const tokens = value.match(/#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|hwb|color)\([^)]*\)|\b[a-z]{3,20}\b/gi) ?? [];
  return tokens.filter((t) => parseColor(t) !== undefined);
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
      const adjusted = { ...textOklch };

      // Push text lightness AWAY from the background until readable (≤20 steps).
      for (let i = 0; i < 20 && wcagContrast(adjusted, bg) < MIN_RATIO; i++) {
        adjusted.l = Math.min(1, Math.max(0, adjusted.l + (bgL > 0.5 ? -0.05 : 0.05)));
      }
      if (wcagContrast(adjusted, bg) < MIN_RATIO) {
        // Bound hit (extreme chroma) — snap to black/white, always passes on a
        // mid-or-extreme background at 20 steps of travel.
        adjusted.l = bgL > 0.5 ? 0 : 1;
        adjusted.c = 0;
      }

      const newHex = formatHex(adjusted);
      const decl = textHit.rule.nodes?.[textHit.declIndex];
      if (decl?.type !== "decl") continue;

      // Check if this would change the value (only apply if different).
      if (decl.value.toLowerCase() === newHex.toLowerCase()) continue;

      const newRatio = wcagContrast(adjusted, bg);
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

  // Final check pass: honest reporting of any remaining unresolved pairs.
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

    let worst = bgTokens[0];
    let worstRatio = Infinity;
    for (const t of bgTokens) {
      const r = wcagContrast(textColor, t);
      if (r < worstRatio) { worstRatio = r; worst = t; }
    }

    if (worstRatio < MIN_RATIO) {
      fixes.push(
        `unresolved: ${pair.text} on ${pair.surface} ${worstRatio.toFixed(1)}:1 (shared declaration conflict)`,
      );
    }
  }

  return { css: root.toString(), fixes };
}
