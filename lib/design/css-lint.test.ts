import { describe, expect, it } from "vitest";
import { lintWireCss } from "./css-lint";

/**
 * The linter is the only thing standing between a model-authored stylesheet and
 * the wireframe's flow. Every case below is a rule shape a REAL generated sheet
 * carried on a live site (owner audit 2026-08-10), plus the two it defeated:
 * every sheet selector is re-scoped to `.tpl-salonwire …` — (0,2,0) — and
 * injected AFTER wire.css, so a single-class wire.css rule merely ties and
 * loses. What the sheet must not be able to say has to be stripped, not
 * out-specified.
 */

describe("flow properties are the wireframe's", () => {
  it("strips the wrap that put the nav CTA back on its own row", () => {
    const { cleanCss } = lintWireCss(
      ".tpl-salonwire .wire-nav__inner { flex-wrap: wrap; background: #fff; }",
    );
    expect(cleanCss).not.toContain("flex-wrap");
    expect(cleanCss).toContain("background: #fff"); // surface is untouched
  });

  it("strips the track count that re-opened the empty grid columns", () => {
    const { cleanCss, violations } = lintWireCss(
      ".tpl-salonwire .wire-grid-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }",
    );
    expect(cleanCss).not.toContain("grid-template-columns");
    expect(violations.join()).toContain("grid-template-columns");
  });

  it("keeps flow properties on the decor layer, which owns its own pseudo-elements", () => {
    const { cleanCss } = lintWireCss(
      '.tpl-salonwire .wire-card::before { display: block; content: ""; aspect-ratio: 1 / 1; }',
    );
    expect(cleanCss).toContain("display: block");
    expect(cleanCss).toContain("aspect-ratio: 1 / 1");
  });
});

describe("geometry-owned selectors", () => {
  it("strips a FLUID size on the nav that the plain size rule would allow", () => {
    // `width: 100%` and `min-width: auto` pass the fluid allowance — which is
    // exactly how the live sheet defeated the badge's box.
    const { cleanCss } = lintWireCss(
      ".tpl-salonwire .wire-nav__links { width: 100%; color: #333; }" +
        ".tpl-salonwire .wire-badge { min-width: auto; border-radius: 999px; }",
    );
    expect(cleanCss).not.toContain("width");
    expect(cleanCss).toContain("color: #333");
    expect(cleanCss).toContain("border-radius: 999px");
  });

  it("leaves the same declaration alone on an ordinary element", () => {
    const { cleanCss } = lintWireCss(".tpl-salonwire .wire-card { width: 100%; }");
    expect(cleanCss).toContain("width: 100%");
  });

  it("strips overflow on the nav bar, where hidden links have no affordance", () => {
    const { cleanCss } = lintWireCss(".tpl-salonwire .wire-nav__links { overflow-x: hidden; }");
    expect(cleanCss).not.toContain("overflow-x");
  });
});
