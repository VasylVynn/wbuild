import { describe, expect, it } from "vitest";
import { converter, parse as parseColor, wcagContrast } from "culori";
import { fixContrast } from "./css-contrast";

/**
 * The two colour bugs this repair used to have: it treated `transparent` as
 * black (and pushed readable text towards invisibility on the real surface),
 * and it paid for contrast by throwing the palette away (a rose heading came
 * back #000000).
 */

const toOklch = converter("oklch");

/** Chroma of a hex, in OKLCH — 0 means the repair desaturated it to grey. */
function chromaOf(hex: string): number {
  const c = toOklch(parseColor(hex)!);
  return c!.c;
}

/** The `color:` value the sheet ends up with for a selector. */
function colorIn(css: string, selector: string): string {
  const rule = css.split("}").find((chunk) => chunk.includes(selector));
  return /color:\s*([^;}]+)/.exec(rule ?? "")?.[1].trim() ?? "";
}

describe("fixContrast — chroma-preserving repair", () => {
  it("keeps the hue's chroma when lightness alone can buy the contrast", () => {
    // Pale rose on white: ~1.7:1, unreadable, but the hue works fine when dark.
    const css = `.tpl-salonwire .wire-hero { background: #ffffff; }
.tpl-salonwire .wire-hero .wire-title { color: #e8b4b8; }`;
    const { css: out, fixes } = fixContrast(css);

    expect(fixes.some((f) => f.startsWith("contrast .wire-title"))).toBe(true);
    const repaired = colorIn(out, ".wire-title");
    expect(repaired).not.toBe("#e8b4b8");
    expect(wcagContrast(repaired, "#ffffff")).toBeGreaterThanOrEqual(4.5);
    // Darker rose, same rose: chroma spent is zero (the old repair returned #000000).
    expect(chromaOf(repaired)).toBeCloseTo(chromaOf("#e8b4b8"), 2);
  });

  it("reports the repaired ratio it actually achieved", () => {
    const css = `.tpl-salonwire .wire-hero { background: #ffffff; }
.tpl-salonwire .wire-hero .wire-title { color: #e8b4b8; }`;
    const { css: out, fixes } = fixContrast(css);
    const repaired = colorIn(out, ".wire-title");
    const claimed = /→ ([\d.]+):1/.exec(fixes.find((f) => f.startsWith("contrast"))!)![1];
    expect(wcagContrast(repaired, "#ffffff")).toBeCloseTo(Number(claimed), 1);
  });

  it("gives chroma away in steps rather than snapping to black", () => {
    // Brick red on mid-grey: no lightness at full chroma clears 4.5:1, so some
    // chroma has to go — but the result must still read as a deep red.
    const css = `.tpl-salonwire .wire-hero { background: #8a8a8a; }
.tpl-salonwire .wire-hero .wire-title { color: #c0392b; }`;
    const { css: out } = fixContrast(css);
    const repaired = colorIn(out, ".wire-title");

    expect(wcagContrast(repaired, "#8a8a8a")).toBeGreaterThanOrEqual(4.5);
    expect(chromaOf(repaired)).toBeLessThan(chromaOf("#c0392b")); // some was spent
    expect(chromaOf(repaired)).toBeGreaterThan(0.05); // but it is not ink
  });

  it("reports a pair no color can resolve instead of pretending it fixed it", () => {
    // Against this grey neither black (4.1:1) nor white clears 4.5:1.
    const css = `.tpl-salonwire .wire-hero { background: #6e6e6e; }
.tpl-salonwire .wire-hero .wire-title { color: #d4a017; }`;
    const { fixes } = fixContrast(css);
    expect(fixes.some((f) => f.startsWith("unresolved: .wire-title"))).toBe(true);
  });

  it("leaves an already-readable pair untouched", () => {
    const css = `.tpl-salonwire .wire-hero { background: #ffffff; }
.tpl-salonwire .wire-hero .wire-title { color: #1a1a1a; }`;
    const { css: out, fixes } = fixContrast(css);
    expect(colorIn(out, ".wire-title")).toBe("#1a1a1a");
    expect(fixes.some((f) => f.startsWith("contrast"))).toBe(false);
  });
});

describe("fixContrast — non-color keywords", () => {
  it("skips a transparent surface instead of judging it black", () => {
    // Under the old parse this was "dark text on black" and the title got
    // lightened until it vanished on the real (light) page behind it.
    const css = `.tpl-salonwire .wire-hero { background: transparent; }
.tpl-salonwire .wire-hero .wire-title { color: #222222; }`;
    const { css: out, fixes } = fixContrast(css);

    expect(colorIn(out, ".wire-title")).toBe("#222222");
    expect(fixes.some((f) => f.startsWith("contrast"))).toBe(false);
    expect(fixes.some((f) => f.startsWith("skipped:"))).toBe(true);
  });

  it("skips a currentcolor text declaration", () => {
    const css = `.tpl-salonwire .wire-hero { background: #101010; }
.tpl-salonwire .wire-hero .wire-title { color: currentcolor; }`;
    const { css: out, fixes } = fixContrast(css);
    expect(colorIn(out, ".wire-title")).toBe("currentcolor");
    expect(fixes.some((f) => f.startsWith("contrast"))).toBe(false);
  });

  it("still reads a real color that sits next to a transparent stop", () => {
    const css = `.tpl-salonwire .wire-hero { background: linear-gradient(transparent, #f7f2ea); }
.tpl-salonwire .wire-hero .wire-title { color: #efe6d8; }`;
    const { css: out, fixes } = fixContrast(css);
    expect(fixes.some((f) => f.startsWith("contrast .wire-title"))).toBe(true);
    expect(wcagContrast(colorIn(out, ".wire-title"), "#f7f2ea")).toBeGreaterThanOrEqual(4.5);
  });
});
