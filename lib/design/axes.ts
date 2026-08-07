import { getVertical } from "@/lib/verticals/registry";
import { FONT_PAIRS, pairWeightFor, type FontPair } from "./font-pairs";
import { hueForVertical } from "./hue";

/**
 * Seeded design axes (pipeline v2 spec 2026-08-07 §4). Every helper here is
 * PURE: a uniform roll in [0, 1) (from `rollAxis` in `lib/design/seed.ts`)
 * plus static data in, a proposal out — the same roll always reproduces the
 * same proposal. Weighted picks mirror `hueForVertical`'s window-weighting:
 * options are chosen in proportion to their declared weight, never uniformly.
 *
 * V1 rolls the proposals and stores the tuple guard; V2 hands them to the S1
 * design brief as defaults the model may reject with rationale. The semantics
 * of variety is «differ from the PREVIOUS generation» (A→B→A is fine) —
 * enforced cheaply by `shouldReroll` over pre-S1 seeded proposals, never by a
 * second model call.
 */

// ---------------------------------------------------------------------------
// Shared weighted pick
// ---------------------------------------------------------------------------

/** Clamp a roll into [0, 1); NaN/out-of-band reads as 0 — these helpers sit in
 *  the generation path, where throwing would cost the tenant its draft. */
function clampRoll(roll: number): number {
  return Number.isFinite(roll) ? Math.min(Math.max(roll, 0), 1 - 1e-9) : 0;
}

/** hueForVertical's cumulative walk, generalized: options claim slices of the
 *  roll in proportion to their weight; zero-weight options claim nothing. */
function pickWeighted<T>(roll: number, options: readonly T[], weightOf: (o: T) => number): T {
  const weights = options.map((o) => Math.max(weightOf(o), 0));
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return options[0]; // degenerate data — fail open, first option
  let travel = clampRoll(roll) * total;
  for (let i = 0; i < options.length; i++) {
    if (travel < weights[i] && weights[i] > 0) return options[i];
    travel -= weights[i];
  }
  // Float dust at the top end — last option with weight.
  for (let i = options.length - 1; i >= 0; i--) {
    if (weights[i] > 0) return options[i];
  }
  return options[0];
}

// ---------------------------------------------------------------------------
// Axis: font pair
// ---------------------------------------------------------------------------

/**
 * Seeded font-pair proposal for a vertical. Weighted over the whitelist
 * (`lib/design/font-pairs.ts`); zero-weight pairs can never be proposed for
 * that vertical. Unknown vertical ids resolve through the registry fallback
 * (`generic`) for consistency with hueForVertical.
 */
export function fontPairForSeed(roll: number, verticalId: string): FontPair {
  const vertical = getVertical(verticalId).id;
  return pickWeighted(roll, FONT_PAIRS, (p) => pairWeightFor(p, vertical));
}

// ---------------------------------------------------------------------------
// Axis: motion level
// ---------------------------------------------------------------------------

export type MotionLevel = 0 | 1 | 2 | 3;

const MOTION_LEVELS: readonly MotionLevel[] = [0, 1, 2, 3];

/** Draw weights for motion levels 0–3, per vertical (spec §1: the level rides
 *  the S1 brief; wire.css carries the mechanics in V3). Calm trades never roll
 *  the loudest level; energetic ones rarely sit still. */
const MOTION_WEIGHTS: Record<string, readonly [number, number, number, number]> = {
  florist: [0, 2, 3, 1],
  bakery: [1, 3, 2, 0],
  lawyer: [1, 3, 2, 0],
  autoservice: [0, 1, 3, 2],
  "pet-grooming": [0, 2, 3, 1],
  generic: [1, 3, 2, 1],
};

/** Exported for the weights-sanity vitest — not for consumers. */
export const MOTION_WEIGHTS_BY_VERTICAL = MOTION_WEIGHTS;

/** Seeded motion-level proposal for a vertical (0 = static … 3 = loud). */
export function motionLevelForSeed(roll: number, verticalId: string): MotionLevel {
  const weights = MOTION_WEIGHTS[getVertical(verticalId).id] ?? MOTION_WEIGHTS.generic;
  return pickWeighted(roll, MOTION_LEVELS, (level) => weights[level]);
}

// ---------------------------------------------------------------------------
// Axis: brief direction («кут подачі»)
// ---------------------------------------------------------------------------

/**
 * The angle the site leads with — seeded so two same-niche sites open from
 * different stories, not just different colours. We seed the ANGLE, not the
 * style: V2 hands the direction to the S1 brief as a starting proposal.
 */
export const BRIEF_DIRECTIONS = [
  "майстер-і-ремесло",
  "результат-клієнта",
  "атмосфера-місця",
  "швидкість-і-зручність",
] as const;

export type BriefDirection = (typeof BRIEF_DIRECTIONS)[number];

/** Seeded brief-direction proposal — uniform, no vertical weighting: every
 *  angle is a legitimate story for every trade. */
export function directionForSeed(roll: number): BriefDirection {
  return BRIEF_DIRECTIONS[Math.floor(clampRoll(roll) * BRIEF_DIRECTIONS.length)];
}

// ---------------------------------------------------------------------------
// Tuple guard (spec §4): «differ from the previous generation»
// ---------------------------------------------------------------------------

/** Degrees per hue bucket: 12 buckets — close hues read as «the same colour
 *  world», so the guard compares buckets, not exact degrees. */
const HUE_BUCKET_DEG = 30;

/** Bucket a hue (any real number of degrees) into 0–11, wrap-aware. */
export function hueBucketOf(hue: number): number {
  if (!Number.isFinite(hue)) return 0;
  return Math.floor((((hue % 360) + 360) % 360) / HUE_BUCKET_DEG);
}

/**
 * The seeded proposals a generation started from — stored in `tenants.brand`
 * (rides the brand spread) so the NEXT generation can compare cheaply.
 * `heroVariant` is the SEEDED proposal (banner veto ignored), never the
 * model's final choice: the guard must compare pre-S1 proposal spaces, which
 * stay stable across photo changes and cost no second model call.
 */
export interface DesignTuple {
  font: string;
  heroVariant: string;
  hueBucket: number;
}

/** Parse a stored tuple out of untyped brand JSON; anything malformed reads as
 *  «no previous tuple» (guard disabled — fail open). */
export function readDesignTuple(value: unknown): DesignTuple | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const v = value as Record<string, unknown>;
  if (
    typeof v.font === "string" &&
    typeof v.heroVariant === "string" &&
    typeof v.hueBucket === "number" &&
    Number.isFinite(v.hueBucket)
  ) {
    return { font: v.font, heroVariant: v.heroVariant, hueBucket: v.hueBucket };
  }
  return undefined;
}

/**
 * Should this generation take ONE extra roll? Only when the new seeded
 * proposals repeat the previous generation on ALL THREE axes — a repeat on
 * one axis is legitimate variety (A→B→A is allowed by design). Never loops:
 * the caller rolls exactly once more and takes whatever comes.
 */
export function shouldReroll(
  prev: DesignTuple | null | undefined,
  next: DesignTuple,
): boolean {
  if (!prev) return false;
  return (
    prev.font === next.font &&
    prev.heroVariant === next.heroVariant &&
    prev.hueBucket === next.hueBucket
  );
}

// Re-export for call sites that build tuples from rolls without importing hue
// directly (keeps the axis surface in one module).
export { hueForVertical };
