import {
  dnaSeed,
  mulberry32,
  pick,
  MOTION_IDS,
  type DesignDNA,
  type MotionId,
} from "./dna";
import { THEME_PRESET_IDS, presetFamily, type ThemePresetId } from "./presets";
import type { PaletteFamily } from "./dna";
import { FONT_PAIR_IDS } from "./font-pairs";
import { bundlesFor, type StyleBundle } from "@/lib/design/bundles";

/**
 * Draw a DesignDNA for a tenant (wave DNA-1). Deterministic: the same
 * tenantId+nonce always yields the same DNA (debuggable); bumping the nonce
 * re-rolls it.
 *
 * Phase-1 distinctness guarantee vs `previous`: the new DNA differs in BOTH
 * the palette FAMILY and the font pair. Graceful degradation (research doc,
 * addendum §3) when the allowed pool is too small for the family guarantee:
 * fall back to «different preset», then to a free draw — never loop forever.
 * Hero archetypes join the guarantee in DNA-2 (bundles).
 */
export function rollDna(opts: {
  tenantId: string;
  nonce: number;
  /** Vertical's allowed presets; absent → all. Unknown ids are ignored. */
  allowedPresets?: readonly string[];
  previous?: DesignDNA | null;
}): DesignDNA {
  const rng = mulberry32(dnaSeed(opts.tenantId, opts.nonce));
  const prev = opts.previous ?? undefined;

  const pool = [
    ...new Set(
      (opts.allowedPresets ?? THEME_PRESET_IDS).filter((id): id is ThemePresetId =>
        (THEME_PRESET_IDS as readonly string[]).includes(id),
      ),
    ),
  ];
  const presets = pool.length ? pool : [...THEME_PRESET_IDS];

  // Palette: prefer a DIFFERENT family than before; degrade to a different
  // preset; degrade to any (single-preset verticals must still resolve).
  // A previous preset with an UNKNOWN family (registry drift) still forces at
  // least a different preset id (codex review).
  const prevFamily = prev ? presetFamily(prev.presetId) : undefined;
  const otherPreset = prev ? presets.filter((id) => id !== prev.presetId) : presets;
  const otherFamily = prevFamily
    ? presets.filter((id) => presetFamily(id) !== prevFamily)
    : otherPreset;
  const presetId =
    pick(rng, otherFamily.length ? otherFamily : otherPreset) ?? presets[0];

  // Font pair: 9 curated pairs — a different one is always available.
  const otherPairs = prev
    ? FONT_PAIR_IDS.filter((id) => id !== prev.fontPairId)
    : FONT_PAIR_IDS;
  const fontPairId = pick(rng, otherPairs) ?? FONT_PAIR_IDS[0];

  // Motion: polish, not a distinctness axis — free draw, «none» kept rare.
  const motionId: MotionId =
    pick(rng, [...MOTION_IDS.filter((m) => m !== "none"), ...MOTION_IDS]) ?? "fade-up";

  return { presetId, fontPairId, motionId, designNonce: opts.nonce };
}

/**
 * Bundle-aware roll (wave DNA-2). Bundles carry four DISTINCT font pairs,
 * palette families and hero archetypes, so «a different bundle than before»
 * satisfies the whole 3-axis guarantee; presets still vary WITHIN the bundle's
 * family between same-bundle draws. The photo inventory decides the hero:
 * photo-poor owners get the bundle's deliberate no-photo archetype, never a
 * degraded band (research risk #6). Composition axis: seeded picks from the
 * bundle's blessed skinAlternates.
 */
export function rollBundleDna(opts: {
  tenantId: string;
  nonce: number;
  verticalId?: string;
  photosCount: number;
  previous?: DesignDNA | null;
  /** DNA-3: the owner-logo palette family — prefer bundles of this family
   *  when the distinctness rules leave any (variety still wins a re-roll). */
  logoFamily?: PaletteFamily | null;
}): { dna: DesignDNA; bundle: StyleBundle } {
  const rng = mulberry32(dnaSeed(opts.tenantId, opts.nonce));
  const prev = opts.previous ?? undefined;

  const pool = bundlesFor(opts.verticalId);
  const others = prev?.bundleId ? pool.filter((b) => b.id !== prev.bundleId) : pool;
  // Single-bundle verticals degrade gracefully (research addendum §3).
  const candidates = others.length ? others : pool;
  // Logo snap (DNA-3): among the allowed candidates prefer the logo's family
  // — never against distinctness (a re-roll away from the only logo-family
  // bundle honestly leaves the family; the next roll may come back).
  const logoMatched = opts.logoFamily
    ? candidates.filter((b) => presetFamily(b.presetIds[0]) === opts.logoFamily)
    : [];
  const bundle = pick(rng, logoMatched.length ? logoMatched : candidates) ?? pool[0];

  const otherPresets = prev
    ? bundle.presetIds.filter((id) => id !== prev.presetId)
    : bundle.presetIds;
  const presetId = pick(rng, otherPresets.length ? otherPresets : bundle.presetIds) ?? bundle.presetIds[0];

  const skinOverrides: Record<string, string> = {
    hero: opts.photosCount > 0 ? bundle.heroArchetype : bundle.photoPoorHero,
  };
  for (const [type, base] of Object.entries(bundle.skins)) {
    const alternates = bundle.skinAlternates?.[type as keyof typeof bundle.skinAlternates];
    skinOverrides[type] = alternates?.length ? (pick(rng, alternates) ?? base ?? "") : (base ?? "");
  }

  const decorId = bundle.decorIds?.length ? pick(rng, bundle.decorIds) : undefined;

  return {
    dna: {
      presetId,
      fontPairId: bundle.fontPairId,
      motionId: pick(rng, bundle.motionIds) ?? "none",
      designNonce: opts.nonce,
      bundleId: bundle.id,
      skinOverrides,
      ...(decorId && { decorId }),
    },
    bundle,
  };
}
