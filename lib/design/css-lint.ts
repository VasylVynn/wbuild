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
 * - on ordinary selectors display/position/float are stripped, and
 *   width/height/min-width/min-height unless the value is fluid
 *   (auto/percentage/fit-content/...); max-width stays (allowed on text);
 * - overflow is stripped only on `.wire-section` selectors (sections must never
 *   clip content); card-level overflow (border-radius clipping) is benign;
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
const STRIP_ON_REAL_ELEMENTS = new Set(["display", "position", "float"]);
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
    rule.walkDecls((decl: Declaration) => {
      const prop = decl.prop.toLowerCase();
      const where = `${rule.selector.slice(0, 80)}`;
      if (STRIP_ALWAYS.has(prop)) {
        violations.push(`stripped \`${prop}\` from \`${where}\``);
        decl.remove();
        return;
      }
      if (!decor && STRIP_ON_REAL_ELEMENTS.has(prop)) {
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
