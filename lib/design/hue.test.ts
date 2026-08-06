import { describe, expect, it } from "vitest";
import { hueForVertical } from "./hue";
import { verticals } from "@/lib/verticals/registry";
import type { HueRange } from "@/lib/verticals/types";

/**
 * The seeded hue anchor must stay inside the windows a vertical declares — that
 * is the entire fix for "a bakery got an acid green". These tests sweep the
 * whole seed space per vertical rather than spot-checking, because the failure
 * mode is a rare roll landing just outside a window edge.
 */

/** Wrap-aware membership: a window may run past 360° (e.g. 330 → 20). */
function inRange(hue: number, r: HueRange): boolean {
  const span = r.to - r.from;
  const width = span <= 0 ? span + 360 : span;
  if (width >= 360) return true;
  const offset = ((hue - r.from) % 360 + 360) % 360;
  return offset <= width;
}

const inAnyRange = (hue: number, ranges: HueRange[]) => ranges.some((r) => inRange(hue, r));

const SEEDS = Array.from({ length: 2000 }, (_, i) => i / 2000);

describe("hueForVertical — range membership", () => {
  for (const [id, config] of Object.entries(verticals)) {
    it(`${id}: every roll lands inside a declared window`, () => {
      const ranges = config.hueRanges;
      expect(ranges, `${id} must declare hueRanges`).toBeTruthy();
      const outside = SEEDS.map((s) => hueForVertical(s, id)).filter(
        (h) => !inAnyRange(h, ranges!),
      );
      expect(outside).toEqual([]);
    });
  }

  it("bakery stays warm and never lands in the cold half", () => {
    const hues = SEEDS.map((s) => hueForVertical(s, "bakery"));
    expect(Math.min(...hues)).toBeGreaterThanOrEqual(20);
    expect(Math.max(...hues)).toBeLessThanOrEqual(70);
  });

  it("autoservice stays in the steel/blue band", () => {
    const hues = SEEDS.map((s) => hueForVertical(s, "autoservice"));
    expect(Math.min(...hues)).toBeGreaterThanOrEqual(195);
    expect(Math.max(...hues)).toBeLessThanOrEqual(250);
  });
});

describe("hueForVertical — wrapping window", () => {
  it("pet-grooming reaches both sides of the 360° seam", () => {
    const hues = SEEDS.map((s) => hueForVertical(s, "pet-grooming"));
    expect(hues.some((h) => h >= 330 && h < 360)).toBe(true); // pink side
    expect(hues.some((h) => h >= 0 && h <= 20)).toBe(true); // peach side
    expect(hues.some((h) => h >= 160 && h <= 200)).toBe(true); // mint window
    // The seam must not leak into the untouched middle of the wheel.
    expect(hues.filter((h) => h > 20 && h < 160)).toEqual([]);
    expect(hues.filter((h) => h > 200 && h < 330)).toEqual([]);
  });
});

describe("hueForVertical — proportional split", () => {
  it("splits between windows by width, not by count", () => {
    // florist: 320–360 (40°) and 90–150 (60°) → roughly 40:60.
    const hues = SEEDS.map((s) => hueForVertical(s, "florist"));
    const pinks = hues.filter((h) => h >= 320).length / hues.length;
    expect(pinks).toBeGreaterThan(0.35);
    expect(pinks).toBeLessThan(0.45);
  });
});

describe("hueForVertical — fallbacks", () => {
  it("an unknown vertical falls back to generic's full circle", () => {
    const hues = SEEDS.map((s) => hueForVertical(s, "nonexistent-trade"));
    expect(Math.min(...hues)).toBe(0);
    expect(Math.max(...hues)).toBe(359);
  });

  it("clamps seeds outside [0,1) and survives NaN", () => {
    for (const seed of [-1, 0, 1, 2, Number.NaN, Number.POSITIVE_INFINITY]) {
      const hue = hueForVertical(seed, "lawyer");
      expect(hue).toBeGreaterThanOrEqual(210);
      expect(hue).toBeLessThanOrEqual(260);
      expect(Number.isInteger(hue)).toBe(true);
    }
  });

  it("is deterministic — the same seed reproduces the same hue", () => {
    expect(hueForVertical(0.42, "bakery")).toBe(hueForVertical(0.42, "bakery"));
  });
});
