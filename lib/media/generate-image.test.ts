import { describe, expect, it } from "vitest";
import { planImagePrompts } from "./generate-image";
import { getVertical, HERO_PROMPT_SUFFIX } from "@/lib/verticals/registry";

/**
 * The owner's report that started this: on a real notary site all five
 * generated pictures looked like the same picture. The old batch took ONE
 * subject and varied the camera — «extreme close-up», «flat-lay» — which
 * changes the framing and not the content; and where no subject existed it drew
 * from a two-prompt pool with Math.random(), i.e. with replacement.
 *
 * Everything below is about the one property that fixes that: no image repeats
 * another, and the run is reproducible per site rather than random per call.
 */
describe("planImagePrompts — five images must be five different images", () => {
  const pool = ["p1", "p2", "p3", "p4", "p5", "p6"];

  it("uses one subject per image, in order, each suffix-bounded", () => {
    const plan = planImagePrompts({ subjects: ["a", "b", "c"], pool, wanted: 3, seed: 1 });
    expect(plan).toEqual([
      `a, ${HERO_PROMPT_SUFFIX}`,
      `b, ${HERO_PROMPT_SUFFIX}`,
      `c, ${HERO_PROMPT_SUFFIX}`,
    ]);
  });

  it("never repeats a prompt, whatever the mix of subjects and pool", () => {
    const plan = planImagePrompts({ subjects: ["a", "b"], pool, wanted: 5, seed: 7 });
    expect(plan.filter(Boolean)).toHaveLength(5);
    expect(new Set(plan).size).toBe(plan.length);
  });

  it("drops duplicate subjects instead of drawing the same picture twice", () => {
    const plan = planImagePrompts({ subjects: ["a", "A", " a "], pool, wanted: 3, seed: 3 });
    expect(plan[0]).toBe(`a, ${HERO_PROMPT_SUFFIX}`);
    // The two repeats fall through to the pool rather than re-using «a».
    expect(plan[1]).not.toContain(HERO_PROMPT_SUFFIX);
    expect(new Set(plan).size).toBe(3);
  });

  it("returns null rather than a repeat when the material runs out", () => {
    const plan = planImagePrompts({ subjects: [], pool: ["only"], wanted: 3, seed: 1 });
    expect(plan).toEqual(["only", null, null]);
  });

  it("is deterministic per seed and different between seeds", () => {
    const a = planImagePrompts({ pool, wanted: 5, seed: 11 });
    const again = planImagePrompts({ pool, wanted: 5, seed: 11 });
    const b = planImagePrompts({ pool, wanted: 5, seed: 12 });
    expect(again).toEqual(a);
    expect(b).not.toEqual(a);
  });

  it("every vertical carries enough pool for a photo-less site (hero + 4)", () => {
    for (const id of ["florist", "bakery", "lawyer", "autoservice", "generic"]) {
      const plan = planImagePrompts({ pool: getVertical(id).imagePrompts, wanted: 5, seed: 5 });
      expect(plan.filter(Boolean), `vertical ${id}`).toHaveLength(5);
      expect(new Set(plan).size, `vertical ${id}`).toBe(5);
    }
  });
});
