import { describe, expect, it } from "vitest";
import { wireChromeVariants } from "./chrome-variants";
import type { DesignSpec } from "@/lib/site/design-spec";

/**
 * The seeded nav/footer silhouette (pipeline v2 §5, interim derivation): the
 * chrome must be a pure function of the designSpec — stable per site, moving
 * only when the spec itself moves — and every registered variant must actually
 * be reachable, or the axis silently collapses back to one silhouette.
 */

const spec = (accent: string, pairId = "playfair-inter"): DesignSpec => ({
  positioning: { promise: "x", painPoints: [], tone: "x" },
  palette: { bg: "#ffffff", surface: "#ffffff", ink: "#111111", accent, accentInk: "#ffffff" },
  typography: { pairId },
  sectionPlan: [{ section: "hero" }],
  motion: { level: 1 },
  imagery: { treatment: "x" },
});

describe("wireChromeVariants", () => {
  it("no designSpec → the base chrome (pre-v2 tenants keep their look)", () => {
    expect(wireChromeVariants(undefined)).toEqual({ nav: "split", footer: "4col" });
  });

  it("is deterministic: the same spec always renders the same chrome", () => {
    const s = spec("#7a1f3d");
    expect(wireChromeVariants(s)).toEqual(wireChromeVariants(spec("#7a1f3d")));
  });

  it("only ever names a registered variant", () => {
    for (let i = 0; i < 64; i++) {
      const { nav, footer } = wireChromeVariants(spec(`#${(i * 123457).toString(16).padStart(6, "0").slice(0, 6)}`));
      expect(["split", "centered-brand"]).toContain(nav);
      expect(["4col", "2col", "single"]).toContain(footer);
    }
  });

  it("every variant is reachable across palettes (the axis really rolls)", () => {
    const navs = new Set<string>();
    const footers = new Set<string>();
    for (let i = 0; i < 64; i++) {
      const s = spec(`#${(i * 999331).toString(16).padStart(6, "0").slice(0, 6)}`, i % 2 ? "playfair-inter" : "manrope-manrope");
      const { nav, footer } = wireChromeVariants(s);
      navs.add(nav);
      footers.add(footer);
    }
    expect(navs).toEqual(new Set(["split", "centered-brand"]));
    expect(footers).toEqual(new Set(["4col", "2col", "single"]));
  });
});
