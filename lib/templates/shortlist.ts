/**
 * Seeded shortlist selection — the combinatorial half of the template shortlist
 * (spec 2026-07-25 §4.2).
 *
 * Deliberately DEPENDENCY-FREE. `lib/templates/registry.ts` imports every
 * template's React wrapper, which pulls in `next/font` and side-effect CSS
 * imports, so it cannot be loaded outside Next. Keeping the draw here makes it
 * runnable from a plain script, and keeps the combinatorics ignorant of what a
 * template is.
 */

/**
 * `k` items drawn from `items` without repetition, driven by a seeded PRNG.
 *
 * Partial Fisher-Yates over a copy: `k` swaps, source array untouched. A `k` at
 * or above the input length returns a full permutation; a `k` below 1 returns
 * an empty array. Deterministic — the same PRNG state always yields the same
 * result, which is what makes the shortlist stable across turns of one
 * conversation.
 */
export function pickN<T>(rng: () => number, items: readonly T[], k: number): T[] {
  const pool = [...items];
  const take = Math.max(0, Math.min(k, pool.length));
  for (let i = 0; i < take; i++) {
    // Clamped so a PRNG that ever returns exactly 1 cannot index out of range.
    const j = Math.min(pool.length - 1, i + Math.floor(rng() * (pool.length - i)));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, take);
}
