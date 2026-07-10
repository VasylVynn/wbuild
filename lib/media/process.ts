import sharp from "sharp";

/**
 * Classical (non-generative) image quality layer for owner uploads (plan 6а).
 * Zero drift by construction: every operation below is a deterministic,
 * well-known image-processing primitive (histogram stretch, mild sharpen,
 * saturation nudge) — never anything generative. `analyzeImage` only reads
 * pixels and returns ready-to-show warnings; `correctImage` only nudges
 * exposure/clarity, never crops, rotates or reframes.
 *
 * TUNING: every threshold and correction parameter lives here as a named
 * constant. To retune the feel of this layer, change a number below —
 * nothing else in the codebase should need to change.
 */

// ── analyze() thresholds ─────────────────────────────────────────────────────
const MIN_DIMENSION = 480; // px, shorter image side below this → "too small" warning
const DARK_MEAN = 60; // 0-255 average RGB channel mean below this → "too dark" warning
const BLUR_SHARPNESS_MIN = 3; // sharp's Laplacian-stdev "sharpness" stat below this → "too blurry" warning
const MAX_WARNINGS = 2; // cap on warnings surfaced to the owner, most severe first

// ── correct() parameters ─────────────────────────────────────────────────────
const NORMALIZE_LOWER = 1; // percentile: luminance below this is clipped to black (contrast stretch)
const NORMALIZE_UPPER = 99; // percentile: luminance above this is clipped to white (contrast stretch)
const SATURATION = 1.06; // modulate() multiplier — a gentle punch-up, not a filter
const SHARPEN_SIGMA = 1.0; // Gaussian mask sigma for a mild sharpen() pass
const OUTPUT_QUALITY = 82; // WebP quality for the corrected output

type Severity = 0 | 1 | 2; // lower = surfaced first when more than MAX_WARNINGS trip

/**
 * Read-only pixel analysis. Never throws: any decode/stat failure is logged
 * and treated as "nothing to warn about" so a bad image never blocks upload.
 */
export async function analyzeImage(buf: Buffer): Promise<{ warnings: string[] }> {
  try {
    const img = sharp(buf);
    const [meta, stats] = await Promise.all([img.metadata(), img.stats()]);
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;
    // Average the R/G/B channel means (unweighted) as a brightness proxy —
    // simpler than perceptual luminance weighting and close enough for a
    // "too dark" nudge rather than a precise exposure measurement.
    const rgbMeans = stats.channels.slice(0, 3).map((c) => c.mean);
    const brightness = rgbMeans.reduce((a, b) => a + b, 0) / (rgbMeans.length || 1);

    const found: { severity: Severity; text: string }[] = [];

    if (Math.min(width, height) > 0 && Math.min(width, height) < MIN_DIMENSION) {
      // Most severe: correction cannot invent missing pixels.
      found.push({ severity: 0, text: "Фото замалої роздільності" });
    }
    if (stats.sharpness < BLUR_SHARPNESS_MIN) {
      // Uses sharp's built-in "sharpness" stat — the standard deviation of a
      // Laplacian convolution (the classic blur-detection proxy). HONEST
      // LIMITATION: this cannot tell "blurred" apart from "genuinely flat
      // scene" (a plain wall, clear sky, solid-color background) — both read
      // as low sharpness. Dark/low-contrast photos also depress this stat
      // even when in focus (verified empirically), which is why darkness
      // outranks it below — least severe/reliable, surfaced last.
      found.push({ severity: 2, text: "Фото трохи розмите — перевірте різкість" });
    }
    if (brightness < DARK_MEAN) {
      // Middle severity: very common and correctImage's normalize()
      // meaningfully fixes it, but still worth telling the owner about.
      found.push({ severity: 1, text: "Фото темнувате — при денному світлі буде краще" });
    }

    found.sort((a, b) => a.severity - b.severity);
    return { warnings: found.slice(0, MAX_WARNINGS).map((f) => f.text) };
  } catch (err) {
    console.warn("[media/process] analyzeImage failed, returning no warnings", err);
    return { warnings: [] };
  }
}

/**
 * Gentle, deterministic correction: contrast stretch, a small saturation
 * nudge, mild sharpen, re-encoded as WebP. No cropping, no rotation, nothing
 * generative. Never throws: any failure falls back to the original buffer
 * untouched (fail-open — the caller still has a usable image).
 */
export async function correctImage(buf: Buffer): Promise<Buffer> {
  try {
    return await sharp(buf)
      .normalize({ lower: NORMALIZE_LOWER, upper: NORMALIZE_UPPER })
      .modulate({ saturation: SATURATION })
      .sharpen({ sigma: SHARPEN_SIGMA })
      .webp({ quality: OUTPUT_QUALITY })
      .toBuffer();
  } catch (err) {
    console.warn("[media/process] correctImage failed, returning original buffer", err);
    return buf;
  }
}
