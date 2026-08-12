import { describe, expect, it } from "vitest";
import { buildFallbackWireCss } from "./fallback-style";
import { lintWireCss } from "./css-lint";

/**
 * Why this exists: a real site (tepla-pich, 2026-08-12) shipped with
 * `wireCss` of length ZERO in both draft and published. Its style leg failed,
 * it was a new tenant so there was no previous sheet, and the compile returned
 * nothing — so the owner got the bare grey wireframe and asked why the design
 * «looks too simple». The S4 audit had called it «pass»: an absent stylesheet
 * has no violations to find.
 */
describe("buildFallbackWireCss — a model failure must not cost the whole design", () => {
  it("breaks the model's lint in ONE deliberate place and nowhere else", () => {
    // The lint strips `--font-*` so a MODEL cannot override fonts the code owns
    // and normally sets inline at render time. On the path where this sheet is
    // used there is no designSpec, so nothing sets them at render time at all —
    // declaring them here is how a v1 site gets typography, and it is why this
    // sheet is injected after the compile rather than through it. Everything
    // else it writes must still obey the same contract.
    const css = buildFallbackWireCss({ hue: 210, pairId: "lora-nunito-sans", motionLevel: 2 });
    expect(lintWireCss(css).violations).toEqual([
      "stripped `--font-heading` from `.tpl-salonwire`",
      "stripped `--font-body` from `.tpl-salonwire`",
    ]);
  });

  it("carries the seeded font pair — the v1 path sets no font vars anywhere else", () => {
    const css = buildFallbackWireCss({ hue: 30, pairId: "lora-nunito-sans" });
    expect(css).toContain("--font-heading: var(--font-lora)");
    expect(css).toContain("--font-nunito-sans");
  });

  it("still styles a site whose font pair is unknown", () => {
    const css = buildFallbackWireCss({ hue: 30, pairId: "not-a-pair" });
    expect(css).not.toContain("--font-heading");
    expect(css).toContain("--wire-ink");
    // With no font pair there is nothing the lint objects to at all.
    expect(lintWireCss(css).violations).toEqual([]);
  });

  it("puts the seeded hue into the accent, so two sites do not match", () => {
    const a = buildFallbackWireCss({ hue: 20 });
    const b = buildFallbackWireCss({ hue: 200 });
    expect(a).not.toEqual(b);
    expect(a).toContain("0.14 20");
    expect(b).toContain("0.14 200");
  });

  it("normalises a hue off the wheel instead of emitting nonsense", () => {
    expect(buildFallbackWireCss({ hue: 370 })).toEqual(buildFallbackWireCss({ hue: 10 }));
    expect(buildFallbackWireCss({ hue: -10 })).toEqual(buildFallbackWireCss({ hue: 350 }));
  });

  it("drops transitions at motion level 0", () => {
    expect(buildFallbackWireCss({ hue: 90, motionLevel: 0 })).not.toContain("transition");
    expect(buildFallbackWireCss({ hue: 90, motionLevel: 1 })).toContain("transition");
  });

  it("wears S1's palette when only the stylist failed — the common brownout", () => {
    // avtomaister-2, live: S1 chose a deep dark premium palette, S2а timed out,
    // and the floor dressed the site in pastel defaults with the good palette
    // sitting unused in the draft.
    const css = buildFallbackWireCss({
      hue: 200,
      palette: { bg: "#14181c", surface: "#1d2328", ink: "#e8eaea", accent: "#2290c3", accentInk: "#0d1417" },
    });
    expect(css).toContain("background: #14181c");
    expect(css).toContain("background: #2290c3");
    expect(css).toContain("color: #0d1417");
    expect(css).not.toContain("oklch(0.97");
    expect(lintWireCss(css).violations).toEqual([]);
  });
});
