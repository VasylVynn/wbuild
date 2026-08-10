import "server-only";
import postcss, { type AtRule, type Declaration, type Rule } from "postcss";

/**
 * Deterministic lint of the model-generated stylesheet against the wire-style
 * prompt contract (lib/design/wire-style.ts SYSTEM). The prompt forbids
 * layout-breaking CSS but nothing verified the model obeyed — this strips the
 * offenders so a bad sheet degrades to "less styled", never "broken mobile".
 *
 * Heuristics (spec 2026-07-28, v1 — deliberately conservative):
 * - every at-rule except @keyframes is stripped wholesale: wire.css owns
 *   responsiveness and decor, a generated @media/@supports/@import is suspect
 *   by definition (invariant §7); font-family declarations stripped too;
 * - rules whose EVERY selector targets ::before/::after are the decor layer —
 *   display/position/float are legitimate there and stay;
 * - on ordinary selectors every FLOW property is stripped (see
 *   STRIP_ON_REAL_ELEMENTS: display, float, the flex and grid placement
 *   properties, order, align-self, aspect-ratio, columns — wire.css owns flow,
 *   the sheet owns surface); position is stripped
 *   only when it's absolute/fixed/sticky — the wireframe provides no
 *   containing blocks, so `position: relative` is a legitimate anchor for a
 *   rule's own ::before/::after decor and stays; and
 *   width/height/min-width/min-height unless the value is fluid
 *   (auto/percentage/fit-content/...); max-width stays (allowed on text);
 * - overflow is stripped only on `.wire-section` selectors (sections must never
 *   clip content); card-level overflow (border-radius clipping) is benign;
 * - on the GEOMETRY_OWNED selectors (nav bar, brand mark, badge, lead form,
 *   gallery mosaic) size/overflow/position are stripped even when the value is
 *   "fluid" — `min-width: auto` and `width: 100%` are how a live sheet defeated
 *   the badge and the nav bar;
 * - url() to any http(s) or protocol-relative origin is stripped (§4.8: no foreign URLs; the sheet
 *   never needs remote assets — data: URIs and gradients stay);
 * - selectors not scoped under .tpl-salonwire are re-scoped (prefixed), so a
 *   leaked selector can't restyle platform chrome.
 */
export interface LintResult {
  cleanCss: string;
  violations: string[];
}

const STRIP_ALWAYS = new Set(["font-family"]);
/** The renderer owns the font pair — it injects `--font-heading`/`--font-body`
 *  as INLINE style from the designSpec (pipeline v2 §1). A model-authored
 *  `--font-*` would beat that injection (`!important` custom properties win
 *  over inline style) or leak globally through an unscoped `:root`, so every
 *  such declaration is stripped, not just the two known names. */
const FONT_VAR_PREFIX = "--font-";
/** Layout PROPERTIES the wireframe owns everywhere (design decision 8.3, owner
 *  audit 2026-08-10). `display`/`float` alone were not enough: a sheet's
 *  `.tpl-salonwire .wire-nav__inner { flex-wrap: wrap }` is (0,2,0), lands after
 *  wire.css and put the CTA back on its own row; `grid-template-columns:
 *  repeat(4, …)` re-opened the empty grid columns at every width the `:has()`
 *  repair does not cover. None of these decide SURFACE — they decide flow, and
 *  flow is wire.css's. Decor rules (::before/::after) keep them all. */
const STRIP_ON_REAL_ELEMENTS = new Set([
  "display",
  "float",
  "flex",
  "flex-wrap",
  "flex-direction",
  "flex-flow",
  "order",
  "align-self",
  "justify-self",
  "aspect-ratio",
  "grid-template-columns",
  "grid-template-areas",
  "grid-auto-flow",
  "grid-column",
  "grid-row",
  "columns",
  "column-count",
]);

/** Selectors whose GEOMETRY is code's, not the stylist's: the chrome bar, the
 *  brand mark, the funnel form, the gallery mosaic. On these, size and overflow
 *  are stripped even when the value passes the fluid allowance — `min-width:
 *  auto` and `width: 100%` are exactly how a live sheet defeated the badge and
 *  the nav. Surface (colour, border, radius, shadow, spacing) is untouched. */
const GEOMETRY_OWNED = [
  ".wire-nav", // the whole bar: __inner, __brandlock, __links, __link, __cta
  ".wire-badge",
  ".wire-brandmark",
  ".wire-footer__logo",
  ".wire-leadform__form",
  ".wire-gallery__masonry",
  ".wire-gallery__col",
];
const GEOMETRY_PROPS =
  /^(width|height|min-width|min-height|inline-size|block-size|min-inline-size|min-block-size|overflow(-x|-y|-inline|-block)?|position|white-space|align-items|align-content)$/i;

function isGeometryOwned(selector: string): boolean {
  return GEOMETRY_OWNED.some((s) => selector.includes(s));
}
/** `position: relative` is a legitimate anchor for a rule's own ::before/::after
 *  decor (the wireframe provides no containing blocks) — only the values that
 *  actually break layout get stripped. */
const BREAKING_POSITION = /^(absolute|fixed|sticky)$/i;
const SIZE_PROPS = new Set(["width", "height", "min-width", "min-height"]);
const FLUID_VALUE = /^(auto|inherit|initial|unset|fit-content|max-content|min-content|100%|\d{1,3}%)$/i;

function isDecorRule(rule: Rule): boolean {
  return rule.selectors.every((s) => s.includes("::before") || s.includes("::after"));
}

export function lintWireCss(css: string): LintResult {
  const violations: string[] = [];
  let root;
  try {
    root = postcss.parse(css);
  } catch (e) {
    // Unparseable sheet: fail-open — ship it untouched, note why.
    return {
      cleanCss: css,
      violations: [`unparseable css (left as-is): ${e instanceof Error ? e.message : e}`],
    };
  }

  root.walkAtRules((at: AtRule) => {
    if (at.name.toLowerCase() !== "keyframes") {
      violations.push(`stripped @${at.name}${at.params ? ` ${at.params.slice(0, 60)}` : ""}`);
      at.remove();
    }
  });

  root.walkRules((rule: Rule) => {
    const decor = isDecorRule(rule);
    const geometry = !decor && isGeometryOwned(rule.selector);
    rule.walkDecls((decl: Declaration) => {
      const prop = decl.prop.toLowerCase();
      const where = `${rule.selector.slice(0, 80)}`;
      if (geometry && GEOMETRY_PROPS.test(prop)) {
        violations.push(`stripped \`${prop}\` from geometry-owned \`${where}\``);
        decl.remove();
        return;
      }
      if (STRIP_ALWAYS.has(prop) || prop.startsWith(FONT_VAR_PREFIX)) {
        violations.push(`stripped \`${prop}\` from \`${where}\``);
        decl.remove();
        return;
      }
      if (!decor && STRIP_ON_REAL_ELEMENTS.has(prop)) {
        violations.push(`stripped \`${prop}: ${decl.value.slice(0, 40)}\` from \`${where}\``);
        decl.remove();
        return;
      }
      if (!decor && prop === "position" && BREAKING_POSITION.test(decl.value.trim())) {
        violations.push(`stripped \`${prop}: ${decl.value.slice(0, 40)}\` from \`${where}\``);
        decl.remove();
        return;
      }
      if (!decor && SIZE_PROPS.has(prop) && !FLUID_VALUE.test(decl.value.trim())) {
        violations.push(`stripped fixed \`${prop}: ${decl.value.slice(0, 40)}\` from \`${where}\``);
        decl.remove();
        return;
      }
      if (prop.startsWith("overflow") && rule.selector.includes(".wire-section")) {
        violations.push(`stripped \`${prop}\` from section \`${where}\``);
        decl.remove();
        return;
      }
      if (/url\(\s*['"]?(?:https?:)?\/\//i.test(decl.value)) {
        violations.push(`stripped external url() in \`${prop}\` from \`${where}\``);
        decl.remove();
        return;
      }
    });
    if (rule.nodes?.length === 0) rule.remove();
  });

  // Re-scope leaked selectors under the wireframe root class.
  root.walkRules((rule: Rule) => {
    if (rule.parent?.type === "atrule") return; // keyframes steps only (all other at-rules stripped above).
    rule.selectors = rule.selectors.map((s) => {
      const t = s.trim();
      if (t.startsWith(".tpl-salonwire") || t.startsWith(":root") || t.startsWith("@")) return s;
      violations.push(`re-scoped leaked selector \`${t.slice(0, 60)}\``);
      return `.tpl-salonwire ${t}`;
    });
  });

  return { cleanCss: root.toString(), violations };
}
