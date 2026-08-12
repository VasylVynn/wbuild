import { describe, expect, it } from "vitest";
import { rollAxis } from "./seed";
import {
  BRIEF_DIRECTIONS,
  COMPOSITION_ARCHETYPES,
  compositionArchetypeForSeed,
  directionForSeed,
  fontPairForSeed,
  hueBucketOf,
  motionLevelForSeed,
  MOTION_WEIGHTS_BY_VERTICAL,
  readDesignTuple,
  shouldReroll,
  type DesignTuple,
} from "./axes";
import { FONT_PAIRS, pairWeightFor } from "./font-pairs";
import { VERTICAL_IDS } from "@/lib/verticals/registry";

/** Deterministic sweep of the roll space — enough resolution to hit every
 *  weighted slice of every axis. */
const SWEEP = Array.from({ length: 1000 }, (_, i) => i / 1000);

describe("rollAxis", () => {
  it("is deterministic: same host+nonce+purpose → same roll", () => {
    expect(rollAxis("kvity.lvh.me", 3, "hue")).toBe(rollAxis("kvity.lvh.me", 3, "hue"));
    expect(rollAxis("kvity.lvh.me", 3, "font")).toBe(rollAxis("kvity.lvh.me", 3, "font"));
  });

  it("keeps purposes independent: different purpose → different stream", () => {
    const purposes = ["hue", "hue-alt", "variant", "font", "motion", "direction", "archetype"];
    const rolls = purposes.map((p) => rollAxis("kvity.lvh.me", 3, p));
    expect(new Set(rolls).size).toBe(purposes.length);
  });

  it("moves on nonce and host changes", () => {
    expect(rollAxis("kvity.lvh.me", 3, "hue")).not.toBe(rollAxis("kvity.lvh.me", 4, "hue"));
    expect(rollAxis("kvity.lvh.me", 3, "hue")).not.toBe(rollAxis("torty.lvh.me", 3, "hue"));
  });

  it("stays in [0, 1)", () => {
    for (const t of SWEEP.slice(0, 50)) {
      const r = rollAxis(`h${t}`, 0, "hue");
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThan(1);
    }
  });

  it("reroll purposes are independent of the original axis", () => {
    expect(rollAxis("kvity.lvh.me", 3, "hue")).not.toBe(rollAxis("kvity.lvh.me", 3, "hue-reroll"));
  });
});

describe("fontPairForSeed", () => {
  it("is deterministic and returns a whitelist pair", () => {
    const a = fontPairForSeed(0.42, "florist");
    const b = fontPairForSeed(0.42, "florist");
    expect(a.id).toBe(b.id);
    expect(FONT_PAIRS.some((p) => p.id === a.id)).toBe(true);
  });

  it("never proposes a zero-weight pair for any registered vertical", () => {
    for (const verticalId of VERTICAL_IDS) {
      for (const roll of SWEEP) {
        const pair = fontPairForSeed(roll, verticalId);
        expect(pairWeightFor(pair, verticalId), `${verticalId} rolled ${pair.id}`).toBeGreaterThan(0);
      }
    }
  });

  it("respects the weighting: serif-lux dominates florist, robust sans dominates autoservice", () => {
    const tally = (verticalId: string) => {
      const counts = new Map<string, number>();
      for (const roll of SWEEP) {
        const id = fontPairForSeed(roll, verticalId).id;
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
      return counts;
    };
    const florist = tally("florist");
    expect(florist.get("playfair-inter")!).toBeGreaterThan(florist.get("manrope-inter")!);
    expect(florist.has("unbounded-manrope")).toBe(false);
    const auto = tally("autoservice");
    expect(auto.has("playfair-inter")).toBe(false);
    expect(auto.has("cormorant-manrope")).toBe(false);
    expect(auto.get("unbounded-manrope")!).toBeGreaterThan(0);
  });

  it("survives garbage input: NaN roll and unknown vertical still return a pair", () => {
    expect(FONT_PAIRS.some((p) => p.id === fontPairForSeed(Number.NaN, "florist").id)).toBe(true);
    expect(FONT_PAIRS.some((p) => p.id === fontPairForSeed(0.5, "no-such-vertical").id)).toBe(true);
  });

  it("every vertical keeps ≥2 reachable pairs — the reroll needs somewhere to go", () => {
    for (const verticalId of VERTICAL_IDS) {
      const reachable = FONT_PAIRS.filter((p) => pairWeightFor(p, verticalId) > 0);
      expect(reachable.length, verticalId).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("motionLevelForSeed", () => {
  it("is deterministic and stays in 0–3", () => {
    for (const verticalId of VERTICAL_IDS) {
      for (const roll of SWEEP.filter((_, i) => i % 25 === 0)) {
        const level = motionLevelForSeed(roll, verticalId);
        expect(level).toBe(motionLevelForSeed(roll, verticalId));
        expect([0, 1, 2, 3]).toContain(level);
      }
    }
  });

  it("never rolls a zero-weight level (lawyer stays off the loudest)", () => {
    for (const roll of SWEEP) {
      expect(motionLevelForSeed(roll, "lawyer")).not.toBe(3);
    }
  });

  it("weights are sane for every registered vertical: 4 levels, positive total", () => {
    for (const verticalId of VERTICAL_IDS) {
      const weights = MOTION_WEIGHTS_BY_VERTICAL[verticalId] ?? MOTION_WEIGHTS_BY_VERTICAL.generic;
      expect(weights).toHaveLength(4);
      expect(weights.reduce((a: number, b: number) => a + b, 0)).toBeGreaterThan(0);
      expect(weights.every((w: number) => w >= 0)).toBe(true);
    }
  });
});

describe("directionForSeed", () => {
  it("returns a listed direction, deterministically, and reaches all of them", () => {
    const seen = new Set<string>();
    for (const roll of SWEEP) {
      const d = directionForSeed(roll);
      expect(BRIEF_DIRECTIONS).toContain(d);
      expect(directionForSeed(roll)).toBe(d);
      seen.add(d);
    }
    expect(seen.size).toBe(BRIEF_DIRECTIONS.length);
  });

  it("tolerates NaN", () => {
    expect(BRIEF_DIRECTIONS).toContain(directionForSeed(Number.NaN));
  });
});

describe("compositionArchetypeForSeed", () => {
  it("returns a listed archetype, deterministically, and reaches all of them", () => {
    const seen = new Set<string>();
    for (const roll of SWEEP) {
      const a = compositionArchetypeForSeed(roll);
      expect(COMPOSITION_ARCHETYPES).toContain(a);
      expect(compositionArchetypeForSeed(roll)).toBe(a);
      seen.add(a);
    }
    expect(seen.size).toBe(COMPOSITION_ARCHETYPES.length);
  });

  it("tolerates NaN", () => {
    expect(COMPOSITION_ARCHETYPES).toContain(compositionArchetypeForSeed(Number.NaN));
  });
});

describe("hueBucketOf", () => {
  it("buckets into 0–11 and wraps", () => {
    expect(hueBucketOf(0)).toBe(0);
    expect(hueBucketOf(29)).toBe(0);
    expect(hueBucketOf(30)).toBe(1);
    expect(hueBucketOf(359)).toBe(11);
    expect(hueBucketOf(360)).toBe(0);
    expect(hueBucketOf(-15)).toBe(11);
    expect(hueBucketOf(Number.NaN)).toBe(0);
  });
});

describe("tuple guard", () => {
  const tuple = (over: Partial<DesignTuple> = {}): DesignTuple => ({
    font: "playfair-inter",
    heroVariant: "split",
    hueBucket: 4,
    archetype: "offer-first",
    ...over,
  });

  it("no previous tuple → never rerolls", () => {
    expect(shouldReroll(undefined, tuple())).toBe(false);
    expect(shouldReroll(null, tuple())).toBe(false);
  });

  it("rerolls ONLY when all four axes repeat", () => {
    expect(shouldReroll(tuple(), tuple())).toBe(true);
    expect(shouldReroll(tuple(), tuple({ font: "manrope-inter" }))).toBe(false);
    expect(shouldReroll(tuple(), tuple({ heroVariant: "banner" }))).toBe(false);
    expect(shouldReroll(tuple(), tuple({ hueBucket: 5 }))).toBe(false);
    expect(shouldReroll(tuple(), tuple({ archetype: "story-first" }))).toBe(false);
  });

  it("readDesignTuple parses stored JSON and rejects malformed shapes", () => {
    expect(readDesignTuple(tuple())).toEqual(tuple());
    expect(readDesignTuple(undefined)).toBeUndefined();
    expect(readDesignTuple(null)).toBeUndefined();
    expect(readDesignTuple("playfair-inter")).toBeUndefined();
    expect(readDesignTuple({ font: "x", heroVariant: "split" })).toBeUndefined();
    expect(readDesignTuple({ font: "x", heroVariant: "split", hueBucket: "4" })).toBeUndefined();
    // Pre-archetype tuples (older generations) must not half-parse: the guard
    // has no archetype to compare, so the whole tuple reads as absent.
    expect(readDesignTuple({ font: "x", heroVariant: "split", hueBucket: 4 })).toBeUndefined();
  });
});
