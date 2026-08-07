import { describe, expect, it } from "vitest";
import { heroVariantForSeed } from "./generate";

/**
 * The seeded hero layout (plan §2, wave B). Two properties matter more than the
 * exact mapping: every id it can return must be a layout the wireframe actually
 * defines, and roll 0 must stay "split" — that is what keeps a caller which
 * hasn't threaded a seed yet on today's behaviour.
 *
 * The id list below is the contract with
 * `components/templates/salonwire/index.ts` → `hero.variants`. It is repeated
 * literally rather than imported because that module pulls in TSX components and
 * a CSS import, neither of which this node-only runner can parse. An id that
 * drifts out of the registry falls back to the default layout at render time —
 * silent, so keep the two in sync by hand.
 */
const REGISTERED_HERO_LAYOUTS = ["split", "mirror", "banner"];
describe("heroVariantForSeed", () => {
  it("returns split for roll 0 (the un-threaded default)", () => {
    expect(heroVariantForSeed(0, true)).toBe("split");
    expect(heroVariantForSeed(0, false)).toBe("split");
  });

  it("spreads the roll across all three layouts", () => {
    const seen = new Set(
      Array.from({ length: 30 }, (_, i) => heroVariantForSeed(i / 30, true)),
    );
    expect(seen).toEqual(new Set(["split", "mirror", "banner"]));
  });

  it("never rolls banner when the hero photo cannot carry one", () => {
    const seen = new Set(
      Array.from({ length: 30 }, (_, i) => heroVariantForSeed(i / 30, false)),
    );
    expect(seen).toEqual(new Set(["split", "mirror"]));
  });

  it("only ever names a layout the wireframe registers", () => {
    for (let i = 0; i < 50; i++) {
      expect(REGISTERED_HERO_LAYOUTS).toContain(heroVariantForSeed(i / 50, true));
    }
  });

  it("is deterministic and survives a junk roll", () => {
    expect(heroVariantForSeed(0.5, true)).toBe(heroVariantForSeed(0.5, true));
    expect(heroVariantForSeed(Number.NaN, true)).toBe("split");
    expect(heroVariantForSeed(1, true)).toBe("banner");
    expect(heroVariantForSeed(-3, true)).toBe("split");
  });
});
