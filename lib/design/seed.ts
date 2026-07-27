/**
 * Deterministic seeding for the one design axis code still decides: the hue
 * anchor handed to the stylesheet generation (`lib/design/wire-style.ts`).
 *
 * Everything else about a site's design is the model's call. This exists only
 * so that two businesses in the same niche don't converge on the same colour
 * world, and so that re-reading a tenant reproduces the same roll — no
 * `Math.random()` anywhere in the generation path.
 */

/** FNV-1a — stable 32-bit hash. */
function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 — tiny deterministic PRNG over an fnv1a seed. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Seed for a tenant's design roll. `nonce` advances on every regeneration, so
 * asking for a new design gives a new hue while the same nonce always
 * reproduces the same one.
 */
export function designSeed(tenantId: string, nonce: number): number {
  return fnv1a(`${tenantId}:${nonce}`);
}
