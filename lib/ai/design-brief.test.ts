import { describe, expect, it } from "vitest";
import {
  allowedVariantsFrom,
  buildWireframeCapabilities,
  parseDesignBriefPayload,
} from "./design-brief";
import { getTemplate } from "@/lib/templates/registry";
import type { DesignSpecContext } from "@/lib/site/design-spec";

/**
 * S1 plumbing (pipeline v2 §3-S1): the capabilities doc is the SAME source for
 * the prompt and the validation whitelist, and a broken tool payload must read
 * as «no brief» (null → v1 fallback), never as a throw.
 */

describe("buildWireframeCapabilities", () => {
  const caps = buildWireframeCapabilities();

  it("lists plannable wireframe sections with their registered variants", () => {
    const hero = caps.find((c) => c.section === "hero");
    expect(hero).toBeDefined();
    // Superset-tolerant: the parallel wireframe session adds variants this
    // wave — the three hero layouts are the floor, not the whole set.
    expect(hero!.variants).toEqual(expect.arrayContaining(["split", "mirror", "banner"]));
    expect(caps.find((c) => c.section === "services")).toBeDefined();
  });

  it("excludes force-injected and unreachable sections from the plan space", () => {
    const ids = caps.map((c) => c.section);
    expect(ids).not.toContain("lead_form");
    expect(ids).not.toContain("contacts");
    // story is fed by switchback — V3 connect decision: plannable exactly when
    // the wireframe registers it as variants-capable (computeUnreachableTypes).
    const storyDef = getTemplate("salonwire")!.sections.story;
    const storyConnected = Object.keys(storyDef?.variants ?? {}).length > 0;
    if (storyConnected) expect(ids).toContain("story");
    else expect(ids).not.toContain("story");
  });

  it("only names sections the wireframe actually registers", () => {
    const template = getTemplate("salonwire")!;
    for (const c of caps) expect(template.sections[c.section]).toBeDefined();
  });

  it("returns [] for a degenerate template (fail-open to v1)", () => {
    const template = getTemplate("salonwire")!;
    expect(buildWireframeCapabilities({ ...template, sections: {}, order: [] })).toEqual([]);
  });
});

describe("parseDesignBriefPayload", () => {
  const ctx: DesignSpecContext = {
    facts: { businessName: "Квіти Лілії", city: "Львів" },
    allowedVariants: allowedVariantsFrom(buildWireframeCapabilities()),
    fallbackPairId: "playfair-inter",
  };

  const validPayload = {
    positioning: {
      promise: "Букети, які говорять за вас",
      painPoints: ["Немає часу шукати флориста"],
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
    sectionPlan: [
      { section: "hero", variant: "mirror", budgetHint: "стисло" },
      { section: "services" },
    ],
    motion: { level: 2, notes: "м'які появи" },
    imagery: { treatment: "теплі повітряні кадри" },
    rationale: "Флористика просить тепла й тактильности.",
  };

  it("returns the validated spec with the rationale peeled off", () => {
    const result = parseDesignBriefPayload(validPayload, ctx);
    expect(result).not.toBeNull();
    expect(result!.rationale).toBe("Флористика просить тепла й тактильности.");
    expect(result!.spec.sectionPlan.map((e) => e.section)).toEqual(["hero", "services"]);
    expect(result!.spec).not.toHaveProperty("rationale");
  });

  it("repairs an out-of-whitelist pairId to the seeded fallback", () => {
    const result = parseDesignBriefPayload(
      { ...validPayload, typography: { pairId: "comic-sans-deluxe" } },
      ctx,
    );
    expect(result!.spec.typography.pairId).toBe("playfair-inter");
    expect(result!.repairs.some((r) => r.includes("pairId"))).toBe(true);
  });

  it("returns null on garbage tool output (→ v1 fallback)", () => {
    expect(parseDesignBriefPayload("not an object", ctx)).toBeNull();
    expect(parseDesignBriefPayload(null, ctx)).toBeNull();
    expect(parseDesignBriefPayload({}, ctx)).toBeNull();
    expect(parseDesignBriefPayload({ ...validPayload, palette: { bg: "beige" } }, ctx)).toBeNull();
  });

  it("returns null when no planned section is a known one", () => {
    const result = parseDesignBriefPayload(
      { ...validPayload, sectionPlan: [{ section: "jumbotron" }, { section: "lead_form" }] },
      ctx,
    );
    expect(result).toBeNull();
  });
});
