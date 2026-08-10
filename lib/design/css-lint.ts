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
 * - IDENTITY (V9): the brand lockup and the owner's mark are not a surface the
 *   stylist decorates — see BRAND_MARK/BRAND_LOCKUP below;
 * - code-owned custom properties (`--font-*`, the logo plate, the hero crop
 *   anchor) are stripped wherever they appear: each is a MEASUREMENT or a
 *   render-time injection, and a sheet declaration silently beats it;
 * - `content` outside a pseudo-element rule, `all` and `content-visibility`
 *   are stripped everywhere: none of the three is a surface property, and each
 *   can take back something the wireframe guarantees (an <img>'s own pixels, a
 *   whole wire.css rule, a section's visibility);
 * - selectors not scoped under .tpl-salonwire are re-scoped (prefixed), so a
 *   leaked selector can't restyle platform chrome.
 */
export interface LintResult {
  cleanCss: string;
  violations: string[];
}

const STRIP_ALWAYS = new Set([
  "font-family",
  /** `all: unset|initial|revert` hands the sheet a reset — one declaration
   *  takes back every wire.css rule on the element at once, flow included.
   *  It is never a surface decision. */
  "all",
  /** `content-visibility: hidden` hides a subtree as thoroughly as
   *  `display: none`, which the prompt already forbids. */
  "content-visibility",
  /** `contain: paint|strict|content` clips a section to its own box — the
   *  section-overflow rule below exists for exactly this failure. */
  "contain",
]);
/** The renderer owns the font pair — it injects `--font-heading`/`--font-body`
 *  as INLINE style from the designSpec (pipeline v2 §1). A model-authored
 *  `--font-*` would beat that injection (`!important` custom properties win
 *  over inline style) or leak globally through an unscoped `:root`, so every
 *  such declaration is stripped, not just the two known names. */
const FONT_VAR_PREFIX = "--font-";
/** The other custom properties wire.css declares as CODE's, for the same reason
 *  and with the same failure mode: each is a MEASUREMENT of the owner's own
 *  asset, not a taste, and a sheet declaration would silently beat the inline
 *  one the renderer sets.
 *  - `--wire-brandmark-plate` is the backdrop measured from the logo's pixels;
 *    a sheet-chosen value paints an invented slab behind the owner's mark.
 *  - `--wire-hero-focus` is the photo's crop anchor; a sheet-chosen value
 *    re-crops a real photograph off the subject.
 *  The stylist's own knobs (`--wire-brandmark-size`/`-max`, `--wire-scrim`,
 *  `--wire-split-order`, …) are untouched — they decide surface, not truth. */
const CODE_OWNED_VARS = new Set(["--wire-brandmark-plate", "--wire-hero-focus"]);
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
  /^(width|height|min-width|min-height|inline-size|block-size|min-inline-size|min-block-size|overflow(-x|-y|-inline|-block)?|position|white-space|align-items|align-content|zoom)$/i;

function isGeometryOwned(selector: string): boolean {
  return GEOMETRY_OWNED.some((s) => selector.includes(s));
}

/* ── IDENTITY (V9) ─────────────────────────────────────────────────────────
 *
 * A live sheet wrote
 *   `.wire-nav__brandlock::before { content:""; background:rgb(185,69,11);
 *     width:9.59px; height:9.59px; border-radius:50% }`
 * and hung an orange dot on the business's identity, right beside its logo.
 * The model broke no rule — the prompt genuinely promises ::before/::after for
 * decor, and a decor rule is exempt from the geometry strip above, so the dot
 * sailed through untouched. The mistake was ours: the brand lockup was ever
 * decoratable. Identity is the one region of the page that is not the
 * stylist's to embellish; ordinary sections keep the promise in full.
 *
 * Two tiers, because they guarantee different things:
 *
 * BRAND_MARK — the owner's own PIXELS (the <img>). Nothing the sheet says may
 * change how they read: no invented backdrop, no fade, no filter/blend, no
 * mask or clip, no transform. `--wire-brandmark-size`/`-max` stay the
 * stylist's — those size the box, they do not touch the artwork.
 *
 * BRAND_LOCKUP — the mark + wordmark blocks in the nav and the footer. These
 * ARE surface: colour, type, weight, tracking and a background on the lockup
 * itself are exactly how a sheet makes the header feel like this business.
 * Only ORNAMENTS are forbidden here.
 */
/** The <img> itself: `.wire-brandmark` plus the two placement aliases the same
 *  element carries (`.wire-nav__logo`, `.wire-footer__logo`). */
const BRAND_MARK = [".wire-brandmark", ".wire-nav__logo", ".wire-footer__logo"];
/** The lockups AROUND the mark, nav and footer alike. */
const BRAND_LOCKUP = [".wire-nav__brandlock", ".wire-nav__brand", ".wire-footer__brandlock"];
const IDENTITY = [...BRAND_MARK, ...BRAND_LOCKUP];

/** Both spellings — a model writes `:before` about as often as `::before`, and
 *  an ornament is an ornament either way. */
const PSEUDO_ELEMENT = /::?(before|after)\b/i;

/** Everything that can change how the owner's artwork READS. Stripped on
 *  BRAND_MARK regardless of value: a logo is never faded, never recoloured,
 *  never masked into a shape we chose, and never given a backdrop we invented
 *  (that backdrop is `--wire-brandmark-plate`, measured from the asset). */
const BRAND_MARK_PROPS =
  /^(background(-[a-z-]+)?|opacity|visibility|filter|backdrop-filter|mix-blend-mode|isolation|clip-path|(-webkit-)?mask(-[a-z-]+)?|transform|rotate|scale|translate)$/i;

/** Hiding VALUES (as opposed to the properties themselves): `opacity: 0.7` is a
 *  legitimate hover treatment, `opacity: 0` on the nav CTA is a broken funnel
 *  (invariant 8). Value-gated on the geometry-owned chrome only. */
const HIDING_OPACITY = /^(0|0?\.0+|0%)$/;
const HIDING_VISIBILITY = /^(hidden|collapse)$/i;

function matchesAny(selector: string, list: readonly string[]): boolean {
  return list.some((s) => selector.includes(s));
}
/** `position: relative` is a legitimate anchor for a rule's own ::before/::after
 *  decor (the wireframe provides no containing blocks) — only the values that
 *  actually break layout get stripped. */
const BREAKING_POSITION = /^(absolute|fixed|sticky)$/i;
const SIZE_PROPS = new Set(["width", "height", "min-width", "min-height"]);
const FLUID_VALUE = /^(auto|inherit|initial|unset|fit-content|max-content|min-content|100%|\d{1,3}%)$/i;

/** ONE authority for "is this a pseudo-element rule": the same regex the
 *  ornament pass uses. Spelling `::before` here and `:before` there made
 *  `content` on a `:before` rule look like `content` on a real element, and
 *  stripping it stops the pseudo-element generating at all — the linter would
 *  have deleted the very decor layer the prompt promises. */
function isDecorRule(rule: Rule): boolean {
  return rule.selectors.every((s) => PSEUDO_ELEMENT.test(s));
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

  // Identity is not decoratable: a pseudo-element hung off the brand mark or a
  // brand lockup is dropped SELECTOR-BY-SELECTOR, so a rule that also decorates
  // ordinary sections keeps working for them.
  root.walkRules((rule: Rule) => {
    const kept = rule.selectors.filter(
      (s) => !(PSEUDO_ELEMENT.test(s) && matchesAny(s, IDENTITY)),
    );
    if (kept.length === rule.selectors.length) return;
    for (const s of rule.selectors) {
      if (!kept.includes(s)) violations.push(`stripped brand ornament \`${s.trim().slice(0, 60)}\``);
    }
    if (kept.length === 0) rule.remove();
    else rule.selectors = kept;
  });

  // …and neither is the strip below. The brand-mark properties are forbidden on
  // the MARK, not on whatever else a grouped rule happens to list beside it, so
  // a mixed rule is SPLIT first: the mark's selectors move into their own copy
  // and only that copy loses the declarations. `.wire-card` must not lose its
  // surface for being in the wrong company.
  root.walkRules((rule: Rule) => {
    if (rule.selectors.length < 2) return;
    const markSel = rule.selectors.filter((s) => matchesAny(s, BRAND_MARK));
    if (markSel.length === 0 || markSel.length === rule.selectors.length) return;
    let touchesMark = false;
    rule.walkDecls((d: Declaration) => {
      if (BRAND_MARK_PROPS.test(d.prop.toLowerCase())) touchesMark = true;
    });
    if (!touchesMark) return;
    const clone = rule.cloneAfter() as Rule;
    clone.selectors = markSel;
    rule.selectors = rule.selectors.filter((s) => !matchesAny(s, BRAND_MARK));
  });

  root.walkRules((rule: Rule) => {
    const decor = isDecorRule(rule);
    const geometry = !decor && isGeometryOwned(rule.selector);
    const mark = matchesAny(rule.selector, BRAND_MARK);
    rule.walkDecls((decl: Declaration) => {
      const prop = decl.prop.toLowerCase();
      const value = decl.value.trim();
      const where = `${rule.selector.slice(0, 80)}`;
      if (mark && BRAND_MARK_PROPS.test(prop)) {
        violations.push(`stripped \`${prop}\` from the brand mark \`${where}\``);
        decl.remove();
        return;
      }
      if (
        geometry &&
        ((prop === "opacity" && HIDING_OPACITY.test(value)) ||
          (prop === "visibility" && HIDING_VISIBILITY.test(value)))
      ) {
        violations.push(`stripped hiding \`${prop}: ${value}\` from \`${where}\``);
        decl.remove();
        return;
      }
      // `content` on a real element is not decoration — on a replaced element
      // (the brand mark is an <img>) it swaps the owner's artwork outright.
      if (!decor && prop === "content") {
        violations.push(`stripped \`content\` from non-pseudo \`${where}\``);
        decl.remove();
        return;
      }
      if (geometry && GEOMETRY_PROPS.test(prop)) {
        violations.push(`stripped \`${prop}\` from geometry-owned \`${where}\``);
        decl.remove();
        return;
      }
      if (STRIP_ALWAYS.has(prop) || prop.startsWith(FONT_VAR_PREFIX) || CODE_OWNED_VARS.has(prop)) {
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
