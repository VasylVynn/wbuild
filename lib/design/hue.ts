import { getVertical } from "@/lib/verticals/registry";
import type { HueRange } from "@/lib/verticals/types";

/**
 * Turning the seeded roll into a hue the niche can actually wear.
 *
 * The seed still owns the variety — that is the whole point of the anchor
 * (`lib/design/wire-style.ts`), and two bakeries must not converge. What
 * changed: a uniform 0–360 roll happily handed a bakery an acid green, so the
 * roll is now confined to the windows the vertical declares (`hueRanges`, data
 * in `lib/verticals/registry.ts`). Within them the model still decides tone,
 * chroma and how much of the site the colour actually claims.
 *
 * Pure and deterministic: the same seed value and vertical always give the same
 * hue, so re-reading a tenant reproduces its design.
 */

const FULL_CIRCLE: HueRange[] = [{ from: 0, to: 360 }];

/** Width of a window in degrees, wrap-aware. A zero/negative span reads as a
 *  full circle — `{from: 0, to: 360}` and `{from: 10, to: 10}` both mean "any". */
function widthOf(range: HueRange): number {
  const span = range.to - range.from;
  const wrapped = span <= 0 ? span + 360 : span;
  return wrapped <= 0 ? 360 : Math.min(wrapped, 360);
}

/**
 * Map a uniform seed roll into the hue windows of a vertical.
 *
 * @param seedValue uniform value in [0, 1) — e.g. `mulberry32(designSeed(...))()`.
 * @param verticalId vertical id; unknown ids fall back to `generic`.
 * @returns an integer hue in [0, 360), always inside one of the vertical's
 *   windows. Windows are chosen in proportion to their width, so a 40° window
 *   and a 60° window next to each other split the roll 40:60 rather than 50:50.
 */
export function hueForVertical(seedValue: number, verticalId: string): number {
  const declared = getVertical(verticalId).hueRanges;
  const ranges = declared && declared.length > 0 ? declared : FULL_CIRCLE;

  // A NaN or out-of-band seed must still produce a usable hue — this sits in
  // the generation path, where throwing would cost the tenant its stylesheet.
  const t = Number.isFinite(seedValue) ? Math.min(Math.max(seedValue, 0), 1 - 1e-9) : 0;

  const widths = ranges.map(widthOf);
  const total = widths.reduce((a, b) => a + b, 0);
  let travel = t * total;
  for (let i = 0; i < ranges.length; i++) {
    if (travel < widths[i] || i === ranges.length - 1) {
      const hue = ranges[i].from + Math.min(travel, widths[i] - 1e-9);
      return Math.floor(((hue % 360) + 360) % 360);
    }
    travel -= widths[i];
  }
  return 0; // unreachable — ranges is never empty
}
