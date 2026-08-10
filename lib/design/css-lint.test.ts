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

  it("strips the values that HIDE the funnel, but keeps a fade as a hover state", () => {
    const { cleanCss } = lintWireCss(
      ".tpl-salonwire .wire-nav__cta { opacity: 0; }" +
        ".tpl-salonwire .wire-leadform__form { visibility: hidden; }" +
        ".tpl-salonwire .wire-nav__link:hover { opacity: 0.7; }",
    );
    expect(cleanCss).not.toContain("opacity: 0;");
    expect(cleanCss).not.toContain("visibility");
    expect(cleanCss).toContain("opacity: 0.7");
  });
});

/**
 * V9 — the brand lockup is identity, not surface. A live sheet wrote
 * `.wire-nav__brandlock::before { content:""; background:rgb(185,69,11);
 * width:9.59px; height:9.59px; border-radius:50% }` and hung an orange dot on a
 * tenant's logo. It broke no rule: the prompt promises ::before/::after for
 * decor, and a decor rule is exempt from the geometry strip, so nothing looked
 * at it. The fix is not "the model misbehaved" — it is that identity was ever
 * decoratable.
 */
describe("identity is not decoratable", () => {
  it("strips the orange dot the live sheet hung on the nav brand lockup", () => {
    const { cleanCss, violations } = lintWireCss(
      '.tpl-salonwire .wire-nav__brandlock::before { content: ""; background: rgb(185,69,11); width: 9.59px; height: 9.59px; border-radius: 50%; }',
    );
    expect(cleanCss.trim()).toBe("");
    expect(violations.join()).toContain("brand ornament");
  });

  it("covers the mark, the wordmark and the footer lockup, both pseudo spellings", () => {
    const { cleanCss } = lintWireCss(
      '.tpl-salonwire .wire-brandmark::after { content: "★"; }' +
        '.tpl-salonwire .wire-nav__brand:before { content: "| "; }' +
        '.tpl-salonwire .wire-footer__brandlock::before { content: ""; }' +
        '.tpl-salonwire .wire-footer__logo::after { content: ""; }',
    );
    expect(cleanCss.trim()).toBe("");
  });

  it("drops ONLY the identity selector from a rule shared with ordinary decor", () => {
    const { cleanCss } = lintWireCss(
      '.tpl-salonwire .wire-card::before, .tpl-salonwire .wire-nav__brandlock::before { content: ""; background: #b9450b; }',
    );
    expect(cleanCss).toContain(".wire-card::before");
    expect(cleanCss).not.toContain("brandlock");
    expect(cleanCss).toContain("background: #b9450b"); // the card keeps its decor
  });

  it("keeps the ::before/::after freedom the prompt promises ordinary sections", () => {
    const { cleanCss, violations } = lintWireCss(
      '.tpl-salonwire .wire-section::before { content: ""; background: #b9450b; }',
    );
    expect(cleanCss).toContain("content");
    expect(violations).toEqual([]);
  });

  it("leaves colour and type on the lockups — that IS the header's character", () => {
    const { cleanCss, violations } = lintWireCss(
      ".tpl-salonwire .wire-nav__brandlock { background: #fff8ee; border-radius: 8px; }" +
        ".tpl-salonwire .wire-nav__brand { color: #2b1a10; letter-spacing: 0.06em; font-weight: 700; }",
    );
    expect(cleanCss).toContain("background: #fff8ee");
    expect(cleanCss).toContain("letter-spacing: 0.06em");
    expect(violations).toEqual([]);
  });
});

describe("the brand mark is the owner's pixels", () => {
  it("strips everything that repaints, fades, masks or distorts the artwork", () => {
    const { cleanCss } = lintWireCss(
      ".tpl-salonwire .wire-brandmark { background: #000; opacity: 0.4; filter: invert(1); " +
        "mix-blend-mode: multiply; clip-path: circle(50%); -webkit-mask-image: linear-gradient(#000,#000); " +
        "transform: rotate(4deg); border-radius: 999px; }",
    );
    for (const gone of [
      "background",
      "opacity",
      "filter",
      "mix-blend-mode",
      "clip-path",
      "mask-image",
      "transform",
    ]) {
      expect(cleanCss).not.toContain(gone);
    }
    expect(cleanCss).toContain("border-radius: 999px"); // the chip's shape stays the stylist's
  });

  it("keeps the size knobs wire.css hands the stylist on the placement aliases", () => {
    const { cleanCss, violations } = lintWireCss(
      ".tpl-salonwire .wire-nav__logo { --wire-brandmark-size: 2.75rem; --wire-brandmark-max: 12rem; }",
    );
    expect(cleanCss).toContain("--wire-brandmark-size: 2.75rem");
    expect(cleanCss).toContain("--wire-brandmark-max: 12rem");
    expect(violations).toEqual([]);
  });

  it("strips `content` on a real element — on an <img> it swaps the logo outright", () => {
    const { cleanCss } = lintWireCss(
      '.tpl-salonwire .wire-brandmark { content: url("data:image/svg+xml,x"); }',
    );
    expect(cleanCss).not.toContain("content");
  });
});

describe("code-owned custom properties and whole-rule resets", () => {
  it("strips the measurements: the logo plate and the hero crop anchor", () => {
    const { cleanCss, violations } = lintWireCss(
      ".tpl-salonwire .wire-brandmark--plated { --wire-brandmark-plate: #000; }" +
        ".tpl-salonwire .wire-hero__bg { --wire-hero-focus: 50% 90%; }",
    );
    expect(cleanCss).not.toContain("--wire-brandmark-plate");
    expect(cleanCss).not.toContain("--wire-hero-focus");
    expect(violations).toHaveLength(2);
  });

  it("keeps the custom properties wire.css declares as the stylist's", () => {
    const { cleanCss } = lintWireCss(
      ".tpl-salonwire .wire-hero { --wire-scrim: linear-gradient(#000, #000); --wire-split-order: -1; }",
    );
    expect(cleanCss).toContain("--wire-scrim");
    expect(cleanCss).toContain("--wire-split-order");
  });

  it("strips `all`, which takes back a whole wire.css rule in one declaration", () => {
    const { cleanCss } = lintWireCss(
      ".tpl-salonwire .wire-nav__inner { all: unset; background: #fff; }",
    );
    expect(cleanCss).not.toContain("all:");
    expect(cleanCss).toContain("background: #fff");
  });

  it("strips content-visibility and contain, which hide or clip real content", () => {
    const { cleanCss } = lintWireCss(
      ".tpl-salonwire .wire-section { content-visibility: hidden; contain: paint; }",
    );
    expect(cleanCss.trim()).toBe("");
  });
});
