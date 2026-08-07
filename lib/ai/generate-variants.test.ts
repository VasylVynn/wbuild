import type { ComponentType, ReactNode } from "react";
import { describe, expect, it } from "vitest";
import {
  computeUnreachableTypes,
  reassignRepeatedLayouts,
  sectionRepeatCap,
  sectionVariantForRoll,
} from "./generate";
import {
  getTemplate,
  type SiteTemplate,
  type TemplateSectionDef,
} from "@/lib/templates/registry";

/**
 * V3 plumbing contracts (pipeline v2 §4/§5):
 *  - the repeat licence is the `repeatable` flag ALONE — variants no longer
 *    unlock repeats (the old coupling would have shipped two CTA bands the
 *    moment cta gained a layout);
 *  - the generic seeded variant fallback rolls uniformly over a section's
 *    layouts, honouring the hero pattern of naming the default;
 *  - switchback's reachability follows the registry at runtime (connect
 *    decision), richText is deleted from the generation surface for good.
 */

const C = (() => null) as ComponentType<{ data: unknown; extra?: unknown }>;
const C2 = (() => null) as ComponentType<{ data: unknown; extra?: unknown }>;
const C3 = (() => null) as ComponentType<{ data: unknown; extra?: unknown }>;

const def = (over: Partial<TemplateSectionDef> = {}): TemplateSectionDef => ({
  block: "cta",
  label: "x",
  description: "x",
  component: C,
  ...over,
});

const tpl = (sections: Record<string, TemplateSectionDef>): SiteTemplate => ({
  id: "t",
  label: "t",
  description: "t",
  verticalIds: [],
  order: Object.keys(sections),
  sections,
  wrapper: C as unknown as ComponentType<{ children: ReactNode }>,
});

const wire = getTemplate("salonwire")!;

describe("sectionRepeatCap", () => {
  it("adding variants to a non-repeatable section does NOT make it repeat", () => {
    // The exact V3 hazard: give the real cta def a registered layout — the cap
    // must stay 1. Two CTA bands are impossible by construction.
    const ctaWithVariants = def({
      ...wire.sections.cta,
      variants: { "centered-card": C2 },
    });
    expect(sectionRepeatCap(ctaWithVariants)).toBe(1);
    expect(sectionRepeatCap(def({ variants: { a: C2, b: C3 } }))).toBe(1);
  });

  it("only the explicit repeatable flag grants the ×2 cap", () => {
    expect(sectionRepeatCap(def({ repeatable: true }))).toBe(2);
    expect(sectionRepeatCap(def({ repeatable: true, variants: { list: C2 } }))).toBe(2);
    expect(sectionRepeatCap(def())).toBe(1);
    expect(sectionRepeatCap(undefined)).toBe(1);
  });

  it("the registered wireframe never flags the one-per-page sections", () => {
    // Coordination guard with the parallel wireframe session: hero, cta,
    // lead_form and contacts must never carry `repeatable` (§5).
    for (const id of ["hero", "cta", "lead_form", "contacts"]) {
      expect(wire.sections[id]?.repeatable, `${id} must not be repeatable`).not.toBe(true);
      expect(sectionRepeatCap(wire.sections[id])).toBe(1);
    }
  });
});

describe("sectionVariantForRoll", () => {
  it("returns undefined (default layout) for a section without variants", () => {
    expect(sectionVariantForRoll(def(), 0.7)).toBeUndefined();
    expect(sectionVariantForRoll(undefined, 0.7)).toBeUndefined();
  });

  it("rolls uniformly over [default, ...variants] when the default is unnamed", () => {
    const d = def({ variants: { a: C2, b: C3 } });
    expect(sectionVariantForRoll(d, 0)).toBeUndefined(); // the default layout
    expect(sectionVariantForRoll(d, 0.34)).toBe("a");
    expect(sectionVariantForRoll(d, 0.99)).toBe("b");
    const seen = new Set(Array.from({ length: 30 }, (_, i) => sectionVariantForRoll(d, i / 30)));
    expect(seen).toEqual(new Set([undefined, "a", "b"]));
  });

  it("honours the hero pattern: a NAMED default is not double-counted", () => {
    const d = def({ component: C, variants: { split: C, mirror: C2 } });
    const seen = new Set(Array.from({ length: 30 }, (_, i) => sectionVariantForRoll(d, i / 30)));
    expect(seen).toEqual(new Set(["split", "mirror"]));
    // The real hero: roll 0 stays "split" — the un-threaded default behaviour.
    expect(sectionVariantForRoll(wire.sections.hero, 0)).toBe("split");
  });

  it("only ever names a registered layout, is deterministic, survives junk", () => {
    const d = def({ variants: { a: C2, b: C3 } });
    for (let i = 0; i < 50; i++) {
      const v = sectionVariantForRoll(d, i / 50);
      expect([undefined, "a", "b"]).toContain(v);
    }
    expect(sectionVariantForRoll(d, 0.5)).toBe(sectionVariantForRoll(d, 0.5));
    expect(sectionVariantForRoll(d, Number.NaN)).toBeUndefined(); // clamps to the first slot
    expect(sectionVariantForRoll(d, -3)).toBeUndefined();
    expect(sectionVariantForRoll(d, 7)).toBe("b");
  });
});

describe("reassignRepeatedLayouts", () => {
  type Placed = Parameters<typeof reassignRepeatedLayouts>[0];

  it("two instances of a named-default section never resolve to the same component", () => {
    // The V3 hazard: services/gallery/testimonials register their default
    // under a NAME (variants.grid === component), so `undefined` and that name
    // are the SAME component — the net must never "fix" a collision by
    // assigning the unnamed default next to the named one.
    const cases = [
      ["services", "grid"],
      ["gallery", "grid"],
      ["testimonials", "cards"],
    ] as const;
    for (const [section, variant] of cases) {
      const sdef = wire.sections[section];
      const placed = [
        { type: sdef.block, props: {}, section, variant },
        { type: sdef.block, props: {}, section, variant },
      ] as unknown as Placed;
      const out = reassignRepeatedLayouts(placed, wire);
      const comps = out.map((sb) => (sb.variant && sdef.variants?.[sb.variant]) || sdef.component);
      expect(
        comps[0],
        `${section}: both instances resolved to the same component (${out.map((sb) => sb.variant).join(", ")})`,
      ).not.toBe(comps[1]);
    }
  });

  it("still offers the unnamed default when the section does NOT name it", () => {
    const t = tpl({ s: def({ block: "cta", variants: { a: C2, b: C3 } }) });
    const placed = [
      { type: "cta", props: {}, section: "s", variant: "a" },
      { type: "cta", props: {}, section: "s", variant: "a" },
    ] as unknown as Placed;
    const out = reassignRepeatedLayouts(placed, t);
    expect(out[0].variant).toBe("a");
    expect(out[1].variant).toBeUndefined(); // the unnamed default IS distinct here
  });
});

describe("computeUnreachableTypes", () => {
  it("richText is unreachable regardless of the registry (deleted for good)", () => {
    expect(computeUnreachableTypes(undefined).has("richText")).toBe(true);
    expect(
      computeUnreachableTypes(
        tpl({ story: def({ block: "switchback", variants: { framed: C2 } }) }),
      ).has("richText"),
    ).toBe(true);
  });

  it("switchback stays burned while the story section has no variants", () => {
    expect(computeUnreachableTypes(undefined).has("switchback")).toBe(true);
    expect(
      computeUnreachableTypes(tpl({ story: def({ block: "switchback" }) })).has("switchback"),
    ).toBe(true);
  });

  it("switchback connects the moment the wireframe registers story variants", () => {
    const connected = tpl({ story: def({ block: "switchback", variants: { framed: C2 } }) });
    expect(computeUnreachableTypes(connected).has("switchback")).toBe(false);
  });
});
