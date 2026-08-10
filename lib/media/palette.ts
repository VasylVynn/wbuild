import { QuantizerCelebi, Score, hexFromArgb } from "@material/material-color-utilities";
import type { PhotoMeta } from "./media";
import { compareHeroFitness, isEligiblePhoto, photoScore } from "./rank";

/**
 * Deterministic per-photo + aggregate palette extraction (pipeline v2 §3-S0).
 * Grounding is CODE, not a model: the hexes come from quantizing the pixels we
 * actually store (the CORRECTED buffer — what the site serves), ranked by
 * Material's Score for UI-theme suitability. Models never see these hexes as
 * questions — the palette rides PhotoMeta as data for the deterministic S0
 * grounding stage, keeping the color axis reproducible across regenerations.
 *
 * FAIL-OPEN everywhere: sharp is a native module that can be absent, so it is
 * imported lazily and any decode/extract failure returns `null` — a missing
 * palette must never block an upload, an import or a generation.
 *
 * `aggregatePalette` is PURE (no sharp, no env) so it is unit-testable in the
 * node-only vitest environment: it consumes the per-photo palettes already on
 * PhotoMeta and never touches pixels.
 */

// ── extraction tuning ────────────────────────────────────────────────────────
/** Longest side of the downscaled quantizer input (≤96×96 ≈ 9K px — Celebi is
 *  O(pixels) and color identity survives far below this). */
const QUANT_MAX_DIM = 96;
/** Cluster budget for the quantizer; Score curates these down to a handful. */
const MAX_QUANT_COLORS = 128;
/** Palette size contract (§3-S0: "4–6 hex"). */
const PALETTE_MAX = 6;
const PALETTE_MIN_TARGET = 4;
/** Pixels below this alpha are background, not color (logo PNGs). */
const ALPHA_OPAQUE_MIN = 128;
/** More transparency than this ⇒ the image is a graphic (logo-like), even when
 *  the caller didn't say so — grayscale marks must keep their real colors. */
const LOGO_TRANSPARENT_RATIO = 0.05;
/** Fixed LCG seed for the quantizer's k-means init (see withSeededRandom). */
const QUANT_SEED = 0x3a17b0c9;

// ── aggregate tuning ─────────────────────────────────────────────────────────
/** photoScore floor: palettes from measurably bad pixels are noise (§13 risk:
 *  "палітра з поганих фото → бруд"). Sits below the unrated default (5) so a
 *  photo with no vision score still contributes, but one degraded-pixels
 *  warning on a mediocre photo pushes it out. */
export const PALETTE_MIN_PHOTO_SCORE = 4;
/** The brand mark is the strongest brand-color signal there is. */
const LOGO_WEIGHT = 3;
/** Hero-candidates carry the site's face — their colors lead (§3-S0). */
const HERO_WEIGHT = 2;

/**
 * Extract a 4–6 hex palette from image bytes. Deterministic for identical
 * bytes; `null` when sharp is unavailable or the image yields no opaque pixels.
 * Transparent pixels are always ignored, so a transparent-background logo run
 * through this generic entry still reads only the mark itself.
 */
export async function extractPalette(buf: Buffer): Promise<string[] | null> {
  return extract(buf, false);
}

/**
 * Alpha-aware logo variant (upload route's kind="logo" branch, which skips the
 * photo quality pass): transparent background ignored, and Score's grayscale/
 * low-usage filter disabled — a black-and-white brand mark must return its real
 * colors, never Score's Google-Blue fallback.
 */
export async function extractLogoPalette(buf: Buffer): Promise<string[] | null> {
  return extract(buf, true);
}

async function extract(buf: Buffer, logo: boolean): Promise<string[] | null> {
  try {
    // Lazy: sharp is native and may fail to load — that must cost nothing.
    const sharp = (await import("sharp")).default;
    const { data, info } = await sharp(buf)
      .resize(QUANT_MAX_DIM, QUANT_MAX_DIM, { fit: "inside", withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    if (info.channels !== 4) return null;

    const pixels: number[] = [];
    let transparent = 0;
    for (let i = 0; i + 3 < data.length; i += 4) {
      if (data[i + 3] < ALPHA_OPAQUE_MIN) {
        transparent += 1;
        continue;
      }
      pixels.push(((0xff << 24) | (data[i] << 16) | (data[i + 1] << 8) | data[i + 2]) >>> 0);
    }
    if (pixels.length === 0) return null; // fully transparent image

    const total = info.width * info.height;
    const graphicLike = logo || (total > 0 && transparent / total > LOGO_TRANSPARENT_RATIO);

    const quantized = withSeededRandom(QUANT_SEED, () =>
      QuantizerCelebi.quantize(pixels, MAX_QUANT_COLORS),
    );
    if (quantized.size === 0) return null;

    // Score ranks by UI-theme suitability. When every color fails its filter it
    // injects a FABRICATED fallback (Google Blue) — Hct round-trips argb exactly,
    // so keeping only colors present in the quantizer output strips it.
    const ranked = Score.score(quantized, { desired: PALETTE_MAX, filter: !graphicLike }).filter(
      (argb) => quantized.has(argb),
    );

    // Top up toward the 4-hex floor from the most-populous quantized colors —
    // deterministic order: population desc, then argb value.
    if (ranked.length < PALETTE_MIN_TARGET) {
      const byPopulation = [...quantized.entries()]
        .sort((a, b) => b[1] - a[1] || a[0] - b[0])
        .map(([argb]) => argb);
      for (const argb of byPopulation) {
        if (ranked.length >= PALETTE_MIN_TARGET) break;
        if (!ranked.includes(argb)) ranked.push(argb);
      }
    }

    const hexes = ranked.slice(0, PALETTE_MAX).map((argb) => hexFromArgb(argb).toLowerCase());
    return hexes.length ? hexes : null;
  } catch (e) {
    console.warn("[media/palette] extraction unavailable:", e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * LOGO PLATE (owner audit 2026-08-10, O1). An owner's mark often ships on an
 * opaque square — typically black — and pasting that square onto a light nav
 * and a dark footer reads as a rendering accident. Cutting the background out
 * is not ours to do at import (that is an edit of the owner's asset), so the
 * chrome instead renders a deliberate chip in the asset's OWN backdrop colour
 * (`.wire-brandmark--plated`). This is the producer for `brand.logoPlate`:
 * a MEASUREMENT of the pixels, never a design choice.
 *
 *   "none"  — the asset has a transparent background (or no uniform backdrop
 *             we can name): the mark sits directly on the chrome surface;
 *   "#rrggbb" — the measured backdrop colour;
 *   null    — could not measure (sharp absent, decode failed): callers persist
 *             nothing, which renders exactly like "none". Fail-open.
 *
 * The backdrop is read off the 1px BORDER RING, not the whole image: the ring
 * is what actually touches the chrome surface, and a mark whose ring is not
 * near-uniform has no plate to draw.
 */
const PLATE_RING_UNIFORM_MIN = 0.9;
/** Max per-channel distance still counted as "the same backdrop colour". */
const PLATE_RING_TOLERANCE = 12;

export async function measureLogoPlate(buf: Buffer): Promise<string | null> {
  try {
    const sharp = (await import("sharp")).default;
    const { data, info } = await sharp(buf)
      .resize(QUANT_MAX_DIM, QUANT_MAX_DIM, { fit: "inside", withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    if (info.channels !== 4 || info.width < 3 || info.height < 3) return null;

    const at = (x: number, y: number) => (y * info.width + x) * 4;
    let transparent = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] < ALPHA_OPAQUE_MIN) transparent += 1;
    const total = info.width * info.height;
    // A transparent-background asset needs no plate — this is the common,
    // already-correct case and it must stay free.
    if (transparent / total > LOGO_TRANSPARENT_RATIO) return "none";

    const ring: number[] = [];
    for (let x = 0; x < info.width; x++) {
      ring.push(at(x, 0), at(x, info.height - 1));
    }
    for (let y = 1; y < info.height - 1; y++) {
      ring.push(at(0, y), at(info.width - 1, y));
    }
    // Modal colour of the ring, bucketed coarsely so JPEG noise still agrees.
    const buckets = new Map<string, { n: number; r: number; g: number; b: number }>();
    for (const i of ring) {
      if (data[i + 3] < ALPHA_OPAQUE_MIN) continue;
      const key = `${data[i] >> 4}.${data[i + 1] >> 4}.${data[i + 2] >> 4}`;
      const cur = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
      cur.n += 1;
      cur.r += data[i];
      cur.g += data[i + 1];
      cur.b += data[i + 2];
      buckets.set(key, cur);
    }
    let best: { n: number; r: number; g: number; b: number } | null = null;
    for (const v of buckets.values()) if (!best || v.n > best.n) best = v;
    if (!best) return "none";
    const mean = [Math.round(best.r / best.n), Math.round(best.g / best.n), Math.round(best.b / best.n)];

    // Uniformity is measured against the MEAN with a tolerance, not against the
    // bucket: a backdrop that straddles two buckets is still one backdrop.
    let near = 0;
    for (const i of ring) {
      if (data[i + 3] < ALPHA_OPAQUE_MIN) continue;
      if (
        Math.abs(data[i] - mean[0]) <= PLATE_RING_TOLERANCE &&
        Math.abs(data[i + 1] - mean[1]) <= PLATE_RING_TOLERANCE &&
        Math.abs(data[i + 2] - mean[2]) <= PLATE_RING_TOLERANCE
      ) {
        near += 1;
      }
    }
    if (near / ring.length < PLATE_RING_UNIFORM_MIN) return "none"; // a photo-ish edge: no plate to draw
    return `#${mean.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
  } catch (e) {
    console.warn("[media/palette] plate measurement unavailable:", e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * `measureLogoPlate` over a stored logo URL — the shape both persist points
 * need (editor logo action, onboarding brand write). Best-effort by contract:
 * a slow or failing fetch returns null and the logo simply ships unplated.
 */
export async function measureLogoPlateFromUrl(url: string, timeoutMs = 4000): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    return await measureLogoPlate(Buffer.from(await res.arrayBuffer()));
  } catch (e) {
    console.warn("[media/palette] plate fetch failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * QuantizerCelebi's WsMeans stage seeds its k-means point→cluster assignment
 * with Math.random (quantizer_wsmeans.js:95) — the ONE nondeterminism in the
 * §3-S0 pipeline. `quantize` is fully synchronous, so patching Math.random with
 * a fixed-seed LCG for the duration of the call cannot leak across async
 * boundaries; restore is in `finally`.
 */
function withSeededRandom<T>(seed: number, fn: () => T): T {
  const original = Math.random;
  let s = seed >>> 0;
  Math.random = () => {
    // Numerical Recipes LCG — quality is irrelevant, only reproducibility is.
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  try {
    return fn();
  } finally {
    Math.random = original;
  }
}

/** The brand mark contributes regardless of photo-quality gates. */
function isLogoMeta(m: PhotoMeta): boolean {
  return m.kind === "logo" || m.role === "logo";
}

/**
 * The metas `aggregatePalette` actually draws colors from — the §3-S0
 * eligibility filter, exported on its own so the pipeline can report the
 * honest PHOTO basis of the aggregated palette («взяв палітру з N фото»):
 * `aggregatePalette().length` counts aggregated COLOURS, not photos, and one
 * photo routinely yields 5 hexes.
 */
export function eligiblePaletteMetas(metas: PhotoMeta[]): PhotoMeta[] {
  return metas.filter((m) => {
    if (!m.palette?.length) return false;
    if (/\/generated\//.test(m.url)) return false;
    if (isLogoMeta(m)) return true;
    if (!isEligiblePhoto(m)) return false;
    return photoScore(m) >= PALETTE_MIN_PHOTO_SCORE;
  });
}

/**
 * Fold per-photo palettes into ONE site-level candidate palette (≤6 hexes,
 * strongest first). Pure and deterministic — unit-testable without sharp.
 *
 * Who counts (§3-S0 + §13): photos with a stored palette that are eligible for
 * the site (rank.ts rules), score at least PALETTE_MIN_PHOTO_SCORE, and are not
 * our own generated imagery (`generated/` storage paths — grounding must come
 * from the business's REAL pixels, never from what we synthesized). The logo
 * bypasses the photo gates: a brand mark is often textHeavy/useOnSite=false yet
 * carries the truest brand colors.
 *
 * Weighting: photoScore × (logo/hero boost), decayed by the color's position in
 * its source palette so leading colors dominate. Ties break by first appearance
 * in hero-fitness order ("hero-candidates first"), then input order — stable.
 */
export function aggregatePalette(metas: PhotoMeta[]): string[] {
  const eligible = eligiblePaletteMetas(metas);

  const ordered = eligible
    .map((m, i) => ({ m, i }))
    .sort(
      (a, b) =>
        Number(isLogoMeta(b.m)) - Number(isLogoMeta(a.m)) ||
        compareHeroFitness(a.m, b.m) ||
        a.i - b.i,
    );

  const totals = new Map<string, number>();
  const firstSeen = new Map<string, number>();
  let seq = 0;
  for (const { m } of ordered) {
    const boost = isLogoMeta(m) ? LOGO_WEIGHT : m.heroCandidate === true ? HERO_WEIGHT : 1;
    const weight = Math.max(photoScore(m), 1) * boost;
    for (const [pos, raw] of m.palette!.entries()) {
      const hex = raw.toLowerCase();
      totals.set(hex, (totals.get(hex) ?? 0) + weight / (pos + 1));
      if (!firstSeen.has(hex)) firstSeen.set(hex, seq++);
    }
  }

  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1] || firstSeen.get(a[0])! - firstSeen.get(b[0])!)
    .slice(0, PALETTE_MAX)
    .map(([hex]) => hex);
}
