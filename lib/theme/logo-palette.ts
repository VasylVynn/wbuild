import "server-only";
import { QuantizerCelebi, Score, Hct } from "@material/material-color-utilities";
import { isStorageUrl } from "@/lib/media/media";
import type { PaletteFamily } from "./dna";

/**
 * Logo → palette FAMILY (design-DNA wave 3). We never feed raw hex into a
 * site — taste and AA contrast are guaranteed by hand-authored presets — the
 * logo only tells the DNA WHICH family of curated presets to prefer, so a
 * salon with a pink logo lands on warm roses and an auto service with a navy
 * logo lands on colds, automatically.
 *
 * Mechanics: fetch the owner's logo (our bucket only, §4.8) → downscale via
 * sharp → Material color quantizer + scorer pick the dominant seed color →
 * its HCT hue/chroma maps onto our five perceptual families.
 *
 * FAIL-OPEN: no logo / fetch / decode / low-signal → null (the roll behaves
 * exactly as before).
 */

const FETCH_TIMEOUT_MS = 10_000;
const MAX_BYTES = 8 * 1024 * 1024;

export function familyFromHct(hue: number, chroma: number): PaletteFamily {
  if (chroma < 12) return "neutral";
  const h = ((hue % 360) + 360) % 360;
  if (h >= 280 && h < 335) return "contrast"; // violets — our statement looks
  if (h >= 160 && h < 280) return "cold"; // teals → blues
  if (h >= 70 && h < 160) return "earthy"; // olives → greens
  return "warm"; // reds, oranges, pinks, warm yellows
}

export async function logoPaletteFamily(logoUrl: string | undefined | null): Promise<PaletteFamily | null> {
  if (!logoUrl || !isStorageUrl(logoUrl)) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let buf: Buffer;
    try {
      const res = await fetch(logoUrl, { signal: controller.signal });
      if (!res.ok) return null;
      buf = Buffer.from(await res.arrayBuffer());
    } finally {
      clearTimeout(timer);
    }
    if (buf.length === 0 || buf.length > MAX_BYTES) return null;

    // sharp is native → lazy + fail-open, same contract as the media layer.
    const sharp = (await import("sharp")).default;
    const { data } = await sharp(buf)
      .resize(64, 64, { fit: "inside" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pixels: number[] = [];
    for (let i = 0; i + 3 < data.length; i += 4) {
      const a = data[i + 3];
      if (a < 128) continue; // transparent pixels say nothing about the brand
      // eslint-disable-next-line no-bitwise
      pixels.push(((0xff << 24) | (data[i] << 16) | (data[i + 1] << 8) | data[i + 2]) >>> 0);
    }
    if (pixels.length < 32) return null; // nearly-empty logo — no signal

    const quantized = QuantizerCelebi.quantize(pixels, 128);
    const ranked = Score.score(quantized);
    if (!ranked.length) return null;
    const hct = Hct.fromInt(ranked[0]);
    return familyFromHct(hct.hue, hct.chroma);
  } catch (e) {
    console.warn(`[logo-palette] failed: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}
