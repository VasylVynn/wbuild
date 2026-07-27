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
 * Known limits (accepted, v1): pairs the map doesn't list aren't checked;
 * background-image patterns skip the pair (unknowable statically); gradients
 * are checked against their WORST color stop.
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

/** Every parseable color token in a value (covers gradients stop-by-stop). */
function colorTokens(value: string): string[] {
  const tokens = value.match(/#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|hwb|color)\([^)]*\)|\b[a-z]{3,20}\b/gi) ?? [];
  return tokens.filter((t) => parseColor(t) !== undefined);
}

interface Hit { rule: Rule; declIndex: number; value: string }

/** Last declaration of `props` in rules mentioning `cls` — later wins, and a
 *  rule that ALSO mentions `context` (section-scoped override) wins over one
 *  that doesn't. Crude cascade, right for .tpl-salonwire-scoped sheets. */
function findLast(root: postcss.Root, cls: string, props: string[], context?: string): Hit | undefined {
  let hit: Hit | undefined;
  let hitHasContext = false;
  root.walkRules((rule) => {
    if (!rule.selector.includes(cls)) return;
    if (rule.selector.includes("::before") || rule.selector.includes("::after")) return;
    const hasContext = Boolean(context && context !== cls && rule.selector.includes(context));
    rule.nodes?.forEach((node, i) => {
      if (node.type !== "decl" || !props.includes(node.prop.toLowerCase())) return;
      if (hitHasContext && !hasContext) return; // scoped hit already found
      hit = { rule, declIndex: i, value: node.value };
      hitHasContext = hasContext;
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

  for (const pair of PAIRS) {
    const textHit = findLast(root, pair.text, ["color"], pair.sameElement ? undefined : pair.surface);
    const bgHit = findLast(root, pair.surface, ["background-color", "background"]);
    if (!textHit || !bgHit) continue;
    if (/url\(/i.test(bgHit.value)) continue; // pattern background — unknowable

    const textColor = parseColor(colorTokens(textHit.value)[0] ?? "");
    const bgTokens = colorTokens(bgHit.value);
    if (!textColor || bgTokens.length === 0) continue;

    // Worst stop governs (gradient-safe; single color = one token).
    let worst = bgTokens[0];
    let worstRatio = Infinity;
    for (const t of bgTokens) {
      const r = wcagContrast(textColor, t);
      if (r < worstRatio) { worstRatio = r; worst = t; }
    }
    if (worstRatio >= MIN_RATIO) continue;

    const bg = parseColor(worst)!;
    const bgL = toOklch(bg)?.l ?? 0.5;
    const adjusted = { ...toOklch(textColor)! };
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
    fixes.push(
      `contrast ${pair.text} on ${pair.surface}: ${worstRatio.toFixed(1)}:1 → ` +
        `${wcagContrast(adjusted, bg).toFixed(1)}:1 (color ${decl.value.slice(0, 30)} → ${newHex})`,
    );
    decl.value = newHex;
  }

  return { css: root.toString(), fixes };
}
