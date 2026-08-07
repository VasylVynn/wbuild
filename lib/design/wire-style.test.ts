import { describe, expect, it } from "vitest";
import { designSpecStyleLines } from "./wire-style";
import type { DesignSpec } from "@/lib/site/design-spec";

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
