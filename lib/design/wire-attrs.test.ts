import { describe, expect, it } from "vitest";
import { wireDesignAttrs } from "./wire-attrs";
import type { DesignSpec } from "@/lib/site/design-spec";

function spec(overrides: Partial<DesignSpec> = {}): DesignSpec {
  return {
    positioning: { promise: "Букети, які говорять за вас", painPoints: [], tone: "тепло" },
    palette: {
      bg: "#faf7f2",
      surface: "#ffffff",
      ink: "#2b2118",
      accent: "#7a1f3d",
      accentInk: "#ffffff",
    },
    typography: { pairId: "playfair-inter" },
    sectionPlan: [{ section: "hero" }],
    motion: { level: 2 },
    imagery: { treatment: "теплі повітряні кадри" },
    ...overrides,
  };
}

describe("wireDesignAttrs", () => {
  it("no designSpec → NO attributes at all (total render, spec §3)", () => {
    expect(wireDesignAttrs(undefined)).toEqual({});
  });

  it("resolves a whitelisted pairId to --font-heading/--font-body vars + motion", () => {
    const attrs = wireDesignAttrs(spec());
    expect(attrs.motion).toBe(2);
    expect(attrs.style).toEqual({
      "--font-heading": "var(--font-playfair), serif",
      "--font-body": "var(--font-inter), sans-serif",
    });
  });

  it("unknown pairId → motion still set, but NO font vars (renderer distrusts persisted data)", () => {
    const attrs = wireDesignAttrs(spec({ typography: { pairId: "comic-sans-papyrus" } }));
    expect(attrs.motion).toBe(2);
    expect(attrs.style).toBeUndefined();
  });

  it("motion level 0 is a real value, not a falsy omission", () => {
    const attrs = wireDesignAttrs(spec({ motion: { level: 0 } }));
    expect(attrs.motion).toBe(0);
  });
});
