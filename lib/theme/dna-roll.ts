import {
  dnaSeed,
  mulberry32,
  pick,
  MOTION_IDS,
  type DesignDNA,
  type MotionId,
} from "./dna";
import { THEME_PRESET_IDS, presetFamily, type ThemePresetId } from "./presets";
import { FONT_PAIR_IDS } from "./font-pairs";

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

  const pool = (opts.allowedPresets ?? THEME_PRESET_IDS).filter((id): id is ThemePresetId =>
    (THEME_PRESET_IDS as readonly string[]).includes(id),
  );
  const presets = pool.length ? pool : [...THEME_PRESET_IDS];

  // Palette: prefer a DIFFERENT family than before; degrade to a different
  // preset; degrade to any (single-preset verticals must still resolve).
  const prevFamily = prev ? presetFamily(prev.presetId) : undefined;
  const otherFamily = prevFamily
    ? presets.filter((id) => presetFamily(id) !== prevFamily)
    : presets;
  const otherPreset = prev ? presets.filter((id) => id !== prev.presetId) : presets;
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
