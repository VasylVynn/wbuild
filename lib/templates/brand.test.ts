import { describe, expect, it } from "vitest";
import { buildTemplateBrand } from "./brand";
import type { SiteTemplate } from "./registry";
import type { DesignSpec } from "@/lib/site/design-spec";

/**
 * The designSpec render-threading contract (pipeline v2 §3): the brief stored
 * on a page-content copy must ride buildTemplateBrand into TemplateBrand — the
 * only channel through which the wireframe wrapper can see it.
 */

// Minimal stand-in — importing the real registry would drag every template
// component module (and its CSS) into a node-only test run.
const template = {
  id: "salonwire",
  label: "",
  description: "",
  verticalIds: [],
  order: [],
  sections: {},
  wrapper: () => null,
} as unknown as SiteTemplate;

const spec: DesignSpec = {
  positioning: { promise: "", painPoints: [], tone: "тепло" },
  palette: {
    bg: "#faf7f2",
    surface: "#ffffff",
    ink: "#2b2118",
    accent: "#7a1f3d",
    accentInk: "#ffffff",
  },
  typography: { pairId: "playfair-inter" },
  sectionPlan: [{ section: "hero" }],
  motion: { level: 3 },
  imagery: { treatment: "повітряно" },
};

describe("buildTemplateBrand designSpec threading", () => {
  it("passes designSpec through to TemplateBrand", () => {
    const brand = buildTemplateBrand("Квіти Люба", [], template, undefined, ".x{}", spec);
    expect(brand.designSpec).toBe(spec);
    expect(brand.wireCss).toBe(".x{}");
  });

  it("omits the key entirely when designSpec is absent (pre-v2 content)", () => {
    const brand = buildTemplateBrand("Квіти Люба", [], template);
    expect("designSpec" in brand).toBe(false);
  });
});
