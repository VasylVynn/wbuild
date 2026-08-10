import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The section-geometry locks in wire.css, asserted against the REAL file.
 *
 * These four rules exist because a GENERATED stylesheet defeated the previous,
 * gentler versions of them on a live site (owner audit 2026-08-10). Every one
 * of them therefore depends on a detail that reads like an accident and invites
 * a future "cleanup": a repeated class name, a `:has()` that could be written
 * as a child selector, a rule whose position in the file is load-bearing. The
 * test states out loud what each detail is for.
 *
 * The generated sheet is injected AFTER wire.css and every one of its selectors
 * is prefixed `.tpl-salonwire`, so its everyday shape is (0,2,0) and merely
 * TYING is losing. A geometry lock has to reach (0,3,0) or better.
 */

const css = readFileSync(new URL("./wire.css", import.meta.url), "utf8");
const tsx = readFileSync(new URL("./sections.tsx", import.meta.url), "utf8");

describe("badge geometry (the step index cannot stretch)", () => {
  it("is written at (0,3,0) via the doubled class, not as a single-class rule", () => {
    // A live sheet carried `.tpl-salonwire .wire-timeline__index { min-width: auto }`
    // — (0,2,0), and `min-width: auto` passes css-lint's fluid-value allowance.
    // `.wire-badge.wire-badge` is the repeat that buys (0,3,0). Do not "tidy".
    expect(css).toContain(".tpl-salonwire .wire-badge.wire-badge {");
  });

  it("declares its own cross size instead of inheriting the flex column's", () => {
    const rule = css.slice(css.indexOf(".tpl-salonwire .wire-badge.wire-badge {"));
    const body = rule.slice(0, rule.indexOf("}"));
    for (const decl of ["align-self: start", "inline-size: fit-content", "flex: 0 0 auto"]) {
      expect(body).toContain(decl);
    }
    // A minimum, not a fixed size: the box may grow for a longer token, and a
    // fixed width/height pair is exactly the bug this rule replaces.
    expect(body).toContain("min-inline-size: var(--wire-badge-size");
    expect(body).toContain("min-block-size: var(--wire-badge-size");
    expect(body).not.toMatch(/\n\s*(width|height):/);
  });

  it("carries the badge class in the markup", () => {
    expect(tsx).toContain('className="wire-badge wire-timeline__index"');
  });
});

describe("short-row grids (never more tracks than children)", () => {
  it("repairs a 2- and 3-item card grid at the widest breakpoint", () => {
    expect(css).toContain(".tpl-salonwire .wire-grid-4:has(> :nth-child(3):last-child)");
    expect(css).toContain(".tpl-salonwire .wire-grid-3:has(> :nth-child(2):last-child)");
    expect(css).toContain(".tpl-salonwire .wire-grid-4:has(> :nth-child(2):last-child)");
  });

  it("fills the shortened row rather than centring the group", () => {
    // The section title is left-aligned; a centred short group would break the
    // section's left edge. N=1 stays the one exception (it centres, above).
    const start = css.indexOf(".tpl-salonwire .wire-grid-4:has(> :nth-child(3):last-child)");
    const block = css.slice(start, css.indexOf("Split:", start));
    expect(block).toContain("repeat(3, minmax(0, 1fr))");
    expect(block).toContain("repeat(2, minmax(0, 1fr))");
    expect(block).not.toContain("margin-inline: auto");
  });
});

describe("FAQ disclosure (exactly one marker, and it is markup)", () => {
  it("hides both native markers", () => {
    expect(css).toMatch(/\.wire-faq__q\s*\{[^}]*list-style:\s*none/);
    expect(css).toContain(".wire-faq__q::-webkit-details-marker { display: none; }");
  });

  it("locks the generated ::before/::after bullet out at (0,3,0)", () => {
    // A live sheet wrote `content: "\2022"` on .wire-faq__q::before — (0,2,0),
    // and css-lint keeps `content` on decor rules by design. Only a stronger
    // selector removes it, so the marker slot stays owned by the markup.
    expect(css).toContain(".tpl-salonwire .wire-faq .wire-faq__q::before");
    expect(css).toContain(".tpl-salonwire .wire-faq .wire-faq__q::after");
  });

  it("ships the chevron inline, palette-driven and hidden from assistive tech", () => {
    const start = tsx.indexOf("function WireDisclosureIcon()");
    expect(start).toBeGreaterThan(-1);
    const icon = tsx.slice(start, tsx.indexOf("export function WireFaq", start));
    expect(icon).toContain('className="wire-faq__icon"');
    expect(icon).toContain('stroke="currentColor"'); // takes each site's palette free
    expect(icon).toContain('width="1em"'); // and its size, with no token to invent
    expect(icon).toContain('aria-hidden="true"'); // <summary> already announces state
    expect(icon).toContain('focusable="false"'); // never its own tab stop
    // No asset to fetch: css-lint strips remote url() and a data: URI in the
    // sheet is a string the stylist can clobber. Markup is the durable place.
    expect(icon).not.toContain("url(");
  });

  it("keeps the rotation as state and only the easing as motion", () => {
    // Reduced motion and data-motion="0" zero every transition-duration; the
    // open/closed indication itself must survive that.
    const rotation = css.indexOf(".wire-faq__item[open] .wire-faq__icon");
    const motionBlock = css.indexOf("@media (prefers-reduced-motion: no-preference)");
    expect(rotation).toBeGreaterThan(-1);
    expect(rotation).toBeLessThan(motionBlock);
    expect(css).toContain(".wire-faq__icon { transition: transform 200ms ease; }");
  });

  it("keeps the 44px hit-area floor on the summary", () => {
    expect(css).toMatch(/\.wire-faq__q\s*\{[^}]*min-block-size:\s*2\.75rem/);
  });
});

describe("masonry closing edge", () => {
  it("renders two explicit columns — multicol cannot address a column's last item", () => {
    // `columns: 2` has no rows and no per-column tail: `:nth-last-child(-n+2)`
    // there selects two items of the SAME column, which is why the previous
    // rule could not level the bottoms (measured 430px apart on a live site).
    expect(tsx).toContain('<div className="wire-gallery__col">{items.slice(0, half)}</div>');
    expect(tsx).toContain('<div className="wire-gallery__col">{items.slice(half)}</div>');
    expect(css).not.toContain("nth-last-child(-n + 2) img.wire-media");
    expect(css).toMatch(/\.wire-gallery__masonry \{[^}]*display: grid/);
  });

  it("lets the last item of EACH column absorb its own column's slack", () => {
    // The columns are grid siblings (stretch), so once each column's tail can
    // grow, both columns end on one line at any count and any width.
    expect(css).toContain(".wire-gallery--masonry-2col .wire-gallery__col > :last-child { flex: 1 1 auto;");
    const rotation = css.indexOf(".wire-gallery__col:nth-child(2) > .wire-gallery__item:nth-child(4n + 2)");
    const tail = css.indexOf(".wire-gallery--masonry-2col .wire-gallery__col > .wire-gallery__item:last-child");
    expect(rotation).toBeGreaterThan(-1);
    expect(tail).toBeGreaterThan(rotation); // ties on (0,5,1): source order decides
  });

  it("still refuses to build a mood board out of three photos", () => {
    expect(tsx).toContain("total < MASONRY_MIN_ITEMS");
    // …but an odd count is fine now: leveling no longer needs a trailing pair.
    expect(tsx).not.toContain("total % 2 !== 0");
  });
});

describe("nav budget (one row per band, at every width)", () => {
  it("uses a grid for band 1 so the CTA can never wrap onto its own band", () => {
    // A flex line breaks on the items' BASE sizes, so `flex-wrap: wrap` put the
    // CTA on a third band at 390px even though the name can ellipsise.
    expect(css).toMatch(/\.wire-nav__inner \{[^}]*display: grid;[^}]*minmax\(0, 1fr\) auto/);
    expect(css).not.toMatch(/\.wire-nav__inner \{[^}]*flex-wrap: wrap/);
  });

  it("goes inline at 1024, not 768 — where the capped set measurably did not fit", () => {
    const inline = css.indexOf("@media (min-width: 1024px) {\n  .wire-nav__inner");
    expect(inline).toBeGreaterThan(-1);
  });

  it("makes the link row the only element that shrinks on the one-row layout", () => {
    const block = css.slice(css.indexOf("@media (min-width: 1024px) {\n  .wire-nav__inner"));
    const body = block.slice(0, block.indexOf("\n}"));
    expect(body).toContain(".wire-nav__brandlock { flex: 0 0 auto; }");
    expect(body).toContain(".wire-nav__links { flex: 0 1 auto; min-inline-size: 0;");
  });
});

describe("footer ink (a link is the colour of the footer's own text)", () => {
  it("locks footer text and links to inherit at (0,3,0)", () => {
    // `.wire-footer__link { color: inherit }` alone is (0,1,0) and loses to the
    // sheet's `.tpl-salonwire .wire-text { color: … }`, whose ink is contrast-
    // checked against light surfaces only.
    expect(css).toContain(".tpl-salonwire .wire-footer :is(.wire-footer__link, .wire-text) { color: inherit; }");
  });

  it("keeps .wire-text off the footer links in the markup", () => {
    const wrapper = readFileSync(new URL("./SalonWireWrapper.tsx", import.meta.url), "utf8");
    expect(wrapper).not.toContain('"wire-text wire-footer__link"');
  });
});
