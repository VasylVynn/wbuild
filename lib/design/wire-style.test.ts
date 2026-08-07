import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { designSpecStyleLines, plannedBlockTypes } from "./wire-style";
import { extractSectionSource } from "./wire-source";
import type { DesignSpec, SectionPlanEntry } from "@/lib/site/design-spec";

/**
 * The S2а brief tail rendered from a designSpec (pipeline v2 §3: «палітра —
 * якір, не диктат»). What must hold: every palette role reaches the stylist,
 * fonts/motion are stated as code-owned facts, and an unknown pairId degrades
 * to «no font line» instead of crashing the styling stage.
 */

const spec: DesignSpec = {
  positioning: {
    promise: "Букети, які говорять за вас",
    painPoints: [],
    tone: "тепло і впевнено",
  },
  palette: {
    bg: "#faf7f2",
    surface: "#ffffff",
    ink: "#2b2118",
    accent: "#7a1f3d",
    accentInk: "#ffffff",
  },
  typography: { pairId: "playfair-inter" },
  sectionPlan: [{ section: "hero" }],
  motion: { level: 2, notes: "м'які появи" },
  imagery: { treatment: "теплі повітряні кадри" },
};

describe("designSpecStyleLines", () => {
  it("carries every palette role hex as an anchor", () => {
    const lines = designSpecStyleLines(spec);
    for (const hex of ["#faf7f2", "#ffffff", "#2b2118", "#7a1f3d"]) {
      expect(lines).toContain(hex);
    }
    expect(lines).toContain("якорі");
  });

  it("names the real font families and forbids font-family authorship", () => {
    const lines = designSpecStyleLines(spec);
    expect(lines).toContain("Playfair Display");
    expect(lines).toContain("Inter");
    expect(lines).toContain("font-family не пиши");
  });

  it("carries the motion level, tone and imagery treatment", () => {
    const lines = designSpecStyleLines(spec);
    expect(lines).toContain("рівень 2");
    expect(lines).toContain("м'які появи");
    expect(lines).toContain("тепло і впевнено");
    expect(lines).toContain("теплі повітряні кадри");
  });

  it("degrades an unknown pairId to no font line instead of crashing", () => {
    const lines = designSpecStyleLines({
      ...spec,
      typography: { pairId: "ghost-pair" },
    });
    expect(lines).not.toContain("ТИПОГРАФІКА");
    expect(lines).toContain("#7a1f3d");
  });
});

/**
 * The V5 prompt-slimming seed set versus the force-injections (invariant 8 /
 * PLAN_EXEMPT_TYPES in lib/ai/generate.ts): gallery is injected by CODE
 * outside any S1 plan — with ≥2 photos, or as the pending generated-atmosphere
 * gallery exactly when a photo-less plan would never name it. The slimmed
 * prompt must therefore always carry the Gallery source, or the section ships
 * with zero generated surface styling (`.wire-gallery` is not in wire.css).
 */

const realTsx = readFileSync(
  new URL("../../components/templates/salonwire/sections.tsx", import.meta.url),
  "utf8",
);

// A plausible S1 plan WITHOUT a gallery entry — the common photo-poor onboard
// case whose pending gallery is force-injected later in assembly.
const PLAN_NO_GALLERY = [
  { section: "services" },
  { section: "story" },
  { section: "faq" },
  { section: "cta" },
] as SectionPlanEntry[];

describe("plannedBlockTypes force-injection seeds", () => {
  it("always keeps the code-injected types, gallery included", () => {
    const types = plannedBlockTypes(PLAN_NO_GALLERY);
    // Mirror of PLAN_EXEMPT_TYPES (lib/ai/generate.ts) — keep the two in sync.
    for (const injected of ["hero", "lead_form", "contacts", "gallery"]) {
      expect(types.has(injected)).toBe(true);
    }
  });

  it("keeps the Gallery source in the slimmed prompt for a gallery-less plan", () => {
    const out = extractSectionSource(realTsx, [...plannedBlockTypes(PLAN_NO_GALLERY)]);
    expect(out.extracted).toBe(true);
    expect(out.source).toContain('BlockProps["gallery"]');
    // The class names the stylist must be able to target.
    expect(out.source).toContain("wire-gallery");
  });
});
