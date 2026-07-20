import { z } from "zod";

/**
 * Design-DNA core (wave DNA-1): the per-site style genome + the seeded PRNG
 * that draws it. PURE module — no imports from tokens/presets (tokens.ts
 * embeds the schema below into themeSchema, so this file must stay leaf).
 *
 * Ids are lenient strings validated at RESOLVE time against their registries
 * (same pattern as templateId): an unknown id in a stored theme must never
 * invalidate the whole row — it just falls back.
 *
 * Persistence: DNA lives INSIDE the theme JSON (draft_theme.dna), so it is
 * versioned draft→published like every other design token (invariant №6:
 * Publish is human-only) and needs NO SQL migration.
 */

export const MOTION_IDS = ["none", "fade-up", "stagger"] as const;
export type MotionId = (typeof MOTION_IDS)[number];

/** Perceptual palette families — the salience axis of re-roll distinctness. */
export const PALETTE_FAMILIES = ["warm", "cold", "neutral", "earthy", "contrast"] as const;
export type PaletteFamily = (typeof PALETTE_FAMILIES)[number];

export const designDnaSchema = z.object({
  presetId: z.string().max(64),
  fontPairId: z.string().max(64),
  // .catch: a motion id written by a NEWER deployment must not invalidate the
  // whole stored theme on an older one — unknown ids degrade to "none".
  motionId: z.enum(MOTION_IDS).catch("none"),
  /** Incremented by every design re-roll; same nonce ⇒ reproducible DNA. */
  designNonce: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER - 1),
  /** DNA-2: style bundle + per-section skin/variant picks from its allowlist. */
  bundleId: z.string().optional(),
  skinOverrides: z.record(z.string(), z.string()).optional(),
  /** DNA-3: decorative treatment token. */
  decorId: z.string().optional(),
});
export type DesignDNA = z.infer<typeof designDnaSchema>;

/** FNV-1a — stable 32-bit hash of tenantId:nonce (no Math.random anywhere). */
export function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 — tiny deterministic PRNG over the fnv1a seed. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function dnaSeed(tenantId: string, nonce: number): number {
  return fnv1a(`${tenantId}:${nonce}`);
}

/** Seeded pick; empty list → undefined (callers handle their own fallback). */
export function pick<T>(rng: () => number, options: readonly T[]): T | undefined {
  if (options.length === 0) return undefined;
  return options[Math.floor(rng() * options.length) % options.length];
}

/**
 * Carry the genome across a MANUAL theme rewrite (switchTheme /
 * switchDesignPack / regenerateSite — codex review, wave DNA-1): the newly
 * applied preset is recorded into the genome; the font pair, motion and the
 * monotonic nonce history survive. Invalid/absent stored DNA carries nothing.
 */
export function carryDnaFields(
  prevTheme: { fontPairId?: string; dna?: unknown } | null | undefined,
  newPresetId?: string,
): { fontPairId?: string; dna?: DesignDNA } {
  const parsed = designDnaSchema.safeParse(prevTheme?.dna);
  if (!parsed.success) {
    return prevTheme?.fontPairId ? { fontPairId: prevTheme.fontPairId } : {};
  }
  const dna = newPresetId ? { ...parsed.data, presetId: newPresetId } : parsed.data;
  return { ...(prevTheme?.fontPairId && { fontPairId: prevTheme.fontPairId }), dna };
}
