import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Deterministic seeding for the design axes code proposes (pipeline v2 spec
 * 2026-08-07 §4): hue anchor, hero-variant default, font pair, motion level,
 * brief direction. The typed axis helpers live in `lib/design/axes.ts`; this
 * module owns the raw mechanics — hash, PRNG, roll, and the nonce that
 * advances them.
 *
 * This exists so that two businesses in the same niche don't converge on the
 * same design world, and so that re-reading a tenant reproduces the same
 * roll — no `Math.random()` anywhere in the generation path.
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
 * asking for a new design gives a new roll while the same nonce always
 * reproduces the same one.
 */
export function designSeed(tenantId: string, nonce: number): number {
  return fnv1a(`${tenantId}:${nonce}`);
}

/**
 * One seeded axis roll in [0, 1). `purpose` names the axis («hue», «variant»,
 * «font», «motion», «direction», …) and keeps axes INDEPENDENT: each purpose
 * hashes to its own PRNG stream, so rerolling one axis never moves another.
 * Purpose strings are part of a tenant's reproducibility contract — renaming
 * one changes every existing tenant's roll for that axis.
 */
export function rollAxis(host: string, nonce: number, purpose: string): number {
  return mulberry32(designSeed(`${host}:${purpose}`, nonce))();
}

// ---------------------------------------------------------------------------
// Nonce advancement
// ---------------------------------------------------------------------------

/** The slice of a Supabase client `advanceDesignNonce` needs — `Pick` of the
 *  SDK type (a hand-rolled structural interface sends tsc into TS2589 against
 *  Supabase's generics); tests cast a plain mock to it. Type-only import, so
 *  this module stays importable under plain-node vitest. */
export type NonceClient = Pick<SupabaseClient, "rpc" | "from">;

/**
 * Advance a tenant's design nonce and return the NEW value — the one seed
 * event of a generation, taken BEFORE any model call.
 *
 * Atomic via the `design_nonce_bump` RPC (migration 0010, rl_bump precedent):
 * the old read-modify-write spanned the ~2-minute model chain, so two
 * parallel generations of one host read the same nonce and produced identical
 * seeds on EVERY axis. The RPC's single UPDATE serializes them.
 *
 * RPC missing/failing (migration not applied yet) falls back to the previous
 * read+1 behavior — fail-open like the rate limiter's in-memory fallback; the
 * caller's own brand write persists the nonce in that case, exactly as before.
 * A fallback READ failure still throws: a transient error must not masquerade
 * as «new tenant» and reset the nonce history (codex review, unchanged).
 */
export async function advanceDesignNonce(client: NonceClient, host: string): Promise<number> {
  try {
    const { data, error } = await client.rpc("design_nonce_bump", { tenant_host: host });
    if (error) throw new Error(error.message);
    // No sign check: the TS fallback itself yields a negative for a stored
    // negative (floor(-5)+1 = -4), and the RPC has already COMMITTED its bump
    // by the time we validate — rejecting a value the fallback could produce
    // would double-advance the counter (review must-fix).
    if (typeof data !== "number" || !Number.isInteger(data)) {
      throw new Error(`unexpected result: ${JSON.stringify(data)}`);
    }
    return data;
  } catch (e) {
    console.warn(
      `design_nonce_bump RPC unavailable for ${host}, falling back to non-atomic read+1: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  const { data, error } = await client.from("tenants").select("brand").eq("host", host).maybeSingle();
  if (error) throw new Error(`design nonce read failed: ${error.message}`);
  const prev = (data as { brand?: { designNonce?: unknown } } | null)?.brand?.designNonce;
  return typeof prev === "number" && Number.isFinite(prev) ? Math.floor(prev) + 1 : 0;
}

/**
 * The nonce value a generation may write BACK into `brand` at the end of its
 * ~2-minute chain. The RPC has already persisted its bump, so a trailing brand
 * write that blindly re-writes the nonce captured minutes earlier can move the
 * stored counter BACKWARDS (two parallel generations: A takes 6, B takes 7,
 * A finishes last and resets 7→6 — the next run then reproduces B's seeds on
 * every axis, the exact collision the atomic RPC exists to prevent). Clamp to
 * whatever the freshly-read base brand already carries; on the read+1 fallback
 * the base is older than the issued nonce, so the issued one wins and gets
 * persisted exactly as before.
 */
export function nonceForBrandWrite(issued: number, baseBrandNonce: unknown): number {
  const base =
    typeof baseBrandNonce === "number" && Number.isFinite(baseBrandNonce)
      ? Math.floor(baseBrandNonce)
      : issued;
  return Math.max(issued, base);
}
