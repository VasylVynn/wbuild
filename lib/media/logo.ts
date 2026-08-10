import "server-only";
import { isStorageUrl, storagePublicPrefix } from "@/lib/media/media";

/**
 * LOGO CANVAS ADAPTATION (owner audit 2026-08-10, L1). An owner's mark very
 * often ships as artwork BAKED ONTO A SOLID CANVAS — most commonly a circular
 * badge exported onto an opaque black square. `object-fit: contain` renders
 * that faithfully, which is exactly the problem: a black tile on a cream nav.
 *
 * The V8 review rejected AI background removal, and rightly: our image layer is
 * text-to-image with no alpha and no matting, a wrong cutout eats glyph strokes,
 * and silently repainting an owner's identity asset is not ours to do. NONE of
 * that applies here. Everything below is DETERMINISTIC sharp work that
 *
 *   - only ever REMOVES pixels it can PROVE are canvas,
 *   - refuses outright whenever it cannot prove it ("none"),
 *   - writes a NEW file and never touches `brand.logoUrl`, so the owner's
 *     original survives and the editor can always fall back to it.
 *
 * Two provable shapes, and only two:
 *
 *   "disc" — the artwork is a circle inscribed in the canvas. Proof: the canvas
 *            colour covers essentially ALL of the region outside the inscribed
 *            circle (99%, and no connected non-canvas blob out there bigger
 *            than a speck — the mask is analytic, so a corner wordmark or an ®
 *            would be erased by geometry alone) and essentially NONE of the
 *            region inside it. Masking to that circle then removes only pixels
 *            we measured to be canvas.
 *   "key"  — rectangular artwork on a uniform LIGHT backdrop. Proof: the border
 *            ring is that one colour, and a flood fill from the border over
 *            canvas-coloured pixels stops before it reaches the image centre.
 *            Connectivity is what makes this safe: an interior canvas-coloured
 *            pixel (the counter of an "O", a dark stroke on a dark canvas) is
 *            unreachable from the border and therefore never removed.
 *
 *            LIGHT is load-bearing and is the second half of the proof. Nothing
 *            in the pixels distinguishes "artwork on a backdrop" from "a solid
 *            badge with a knocked-out glyph" — a navy square with a white
 *            wordmark keys exactly like a wordmark on navy paper, and keying it
 *            deletes the badge and leaves white ink on a cream nav, i.e. an
 *            invisible logo. So the key demands what a BACKDROP looks like (a
 *            near-paper tone) AND that what survives still reads against the
 *            chrome surface it will be drawn on. Anything else is refused.
 *
 * FAIL-OPEN like the rest of the media layer: sharp is lazy, every failure path
 * returns null, and a null means "ship the original", never a broken render.
 */

// ── classifier tuning ────────────────────────────────────────────────────────
/** Classification grid. Nearest-neighbour sampled so every sample is a REAL
 *  source pixel — an averaging kernel would invent canvas/artwork blends at the
 *  very boundary the proofs are about. */
const SAMPLE_DIM = 64;
/** Below this the sample is too coarse for the geometry to mean anything. */
const SAMPLE_MIN_DIM = 8;
/** Alpha below this is "transparent" — same cut palette.ts uses. */
const ALPHA_OPAQUE_MIN = 128;
/** The asset already carries a cutout: leave it completely alone. 0.5% is well
 *  under any real transparent-background logo (they run 20–60%) and well above
 *  a stray encoder artefact in a nominally opaque RGBA file. */
const ALPHA_EXISTING_MIN = 0.005;
/** Max per-channel spread across the four corner patches. The measured tennis
 *  asset has corners at exactly (0,0,0) — spread 0. 16 absorbs WebP/JPEG ringing
 *  on a flat canvas while a photograph's four corners disagree by far more. */
const CANVAS_CORNER_TOL = 16;
/** Chebyshev distance within which a pixel counts AS the canvas colour. The
 *  measured asset's nearest artwork sample is [174,224,241] — 174 away from
 *  black, seven times this tolerance. Nothing in the artwork can be mistaken
 *  for canvas at 24. */
const KEY_TOL = 24;
/** The canvas must be visibly distinct from the artwork, or "background" is a
 *  fiction. At least this share of non-canvas pixels must sit this far from the
 *  canvas colour. */
const ARTWORK_SEPARATION_MIN = 48;
const ARTWORK_SEPARATION_RATIO = 0.5;
/** No canvas worth removing / nothing left after removing it. */
const CANVAS_COVERAGE_MIN = 0.03;
const CANVAS_COVERAGE_MAX = 0.9;
/** Disc proof. The ±2% annulus around the inscribed circle is EXCLUDED from
 *  both counts: those pixels are the artwork's own anti-aliased rim and belong
 *  to neither side honestly.
 *
 *  MEASURED on the real asset (1080² disc on black, sampled 64² nearest): the
 *  inside ratio is 0 at every width, but the outside ratio is 0.9621 at ±2%
 *  and exactly 1.0000 at ±4% — the rim of a disc that big spans more than 2%
 *  of the radius, so a ±2% annulus leaves ~4% of its own edge sitting in the
 *  "outside" count and the 0.99 gate below refuses the very case this exists
 *  for. ±4% excludes the rim and nothing else: a corner wordmark lives out at
 *  r·1.41 and is still judged by both the ratio and the blob test. */
const DISC_ANNULUS = 0.04;
/** 0.99, not 0.92: `discAlpha` masks by RADIUS ALONE — it never revisits the
 *  pixels — so every non-canvas pixel this ratio tolerates outside the circle is
 *  artwork we MEASURED and delete anyway. The measured asset scores ≈1.00, so
 *  the old 8% of slack bought the target case nothing and cost a corner
 *  wordmark everything. */
const DISC_OUTSIDE_CANVAS_MIN = 0.99;
/** …and a ratio alone is not enough: 1% of a 64² sample is 40 pixels, which at
 *  1024px is a legible wordmark. The largest CONNECTED non-canvas blob outside
 *  the circle must be a speck (0.2% of the image ≈ 8 samples): isolated encoder
 *  noise still passes, an "EST. 1998" strip never does. */
const DISC_OUTSIDE_BLOB_MAX = 0.002;
const DISC_INSIDE_CANVAS_MAX = 0.02;
/** Key proof: the 1px border ring must be this uniformly canvas. Tighter than
 *  palette.ts's plate ring (0.9) because here we DELETE pixels rather than
 *  paint a chip behind them. */
const BORDER_CANVAS_MIN = 0.95;
/** Key proof, part two — see the header. A BACKDROP is paper-toned; a solid
 *  badge's fill is not. 0.6 relative luminance is about #cbcbcb, so every
 *  white/off-white/cream export passes and every saturated or dark tile is
 *  refused as "the artwork's own fill". */
const KEY_CANVAS_LUMINANCE_MIN = 0.6;
/** …and what survives must still be visible where it lands. The chrome surface
 *  the mark is drawn on is wire.css's `--wire-surface: #fafafa`. 3:1 is the
 *  WCAG non-text contrast floor — below it we have made the logo disappear,
 *  which is strictly worse than the tile we set out to remove. */
const CHROME_SURFACE_RGB: Rgb = [250, 250, 250];
const KEY_INK_CONTRAST_MIN = 3;
/** The full-resolution fill may not exceed the sampled proof by more than this.
 *  The 64² sample skips 15 of every 16 source pixels, so a hairline gap in an
 *  outline can be invisible to the classifier and wide open at 1024px; a fill
 *  that leaks through it swallows the interior. */
const KEY_FILL_DIVERGENCE_MAX = 1.5;

// ── transform tuning ─────────────────────────────────────────────────────────
/** Working resolution. A brand mark renders at 28–40 CSS px; 1024 is already
 *  4× a retina nav lockup, and it bounds the per-pixel JS below. */
const WORK_MAX_DIM = 1024;
/** Disc mask: pull the cut 1px inside the inscribed radius and ramp over 1.5px,
 *  so the anti-aliased rim (which is part canvas) cannot survive as a dark ring.
 *  At the 1024px working size that is 0.2% of the radius — 0.04 CSS px at a 36px
 *  nav mark. */
const DISC_EDGE_INSET_PX = 1;
const DISC_FEATHER_PX = 1.5;
/** Key mask: grow the background by one pixel (the mixed edge pixels are part
 *  canvas → they are the halo) and feather what remains. */
const KEY_FEATHER_SIGMA = 0.8;
/** Output encoding for the adapted mark. Alpha is the whole point, so it is
 *  carried losslessly; colour is a light re-encode of already-lossy source. */
const OUT_QUALITY = 92;
/** The canvas we removed was also the mark's padding, and `.wire-brandmark`
 *  sizes by `block-size` with `object-fit: contain` — leave the padding in as
 *  transparency and the ink renders smaller than before, floating away from the
 *  wordmark. Trimming makes the mark's BOX its ink box. A degenerate result
 *  (under a tenth of either dimension) means the alpha map is wrong, not that
 *  the mark is tiny: refuse and ship the original. */
const TRIM_MIN_RATIO = 0.1;

/** Storage layout: the adapted mark is a SIBLING of the original, named by a
 *  pure function of it, so producing it twice is idempotent. */
const BUCKET = "photos";
const ADAPTED_SUFFIX = "-mark";
/** `<uuid>/<name>.<ext>` — the shape every URL our upload/import paths mint. */
const STORAGE_PATH_RE = /^[^/\\]+\/[^/\\]+$/;

/** RGBA samples of a logo, row-major. Pure data so the classifier is testable
 *  without sharp (vitest is node-only by design). */
export type LogoSample = {
  width: number;
  height: number;
  /** length === width * height * 4 */
  data: ArrayLike<number>;
  /** The SOURCE image declared an alpha channel (sharp metadata.hasAlpha). */
  declaredAlpha: boolean;
};

export type Rgb = [number, number, number];

/** sharp's default export, threaded from the ONE lazy import in adaptLogoBuffer. */
type SharpFactory = (typeof import("sharp"))["default"];

/** What we PROVED about the asset, and therefore what we are allowed to do. */
export type LogoPlan =
  | { kind: "alpha" }
  | { kind: "disc"; canvas: Rgb }
  /** `fill` = the share of the SAMPLE the border-connected fill covered. The
   *  transform re-runs that fill at working resolution and must land near this
   *  number; a materially larger one means it found a gap the sample never saw. */
  | { kind: "key"; canvas: Rgb; fill: number }
  | { kind: "none"; reason: string };

function none(reason: string): LogoPlan {
  return { kind: "none", reason };
}

/** WCAG relative luminance of an sRGB triple. */
function relLuminance(r: number, g: number, b: number): number {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** CIE L* from relative luminance — a perceptual lightness the "is this mark
 *  the same tone as the surface behind it" question can be asked in. */
function lStar(y: number): number {
  return y <= 0.008856 ? 903.3 * y : 116 * Math.cbrt(y) - 16;
}

function contrastRatio(y1: number, y2: number): number {
  const [hi, lo] = y1 >= y2 ? [y1, y2] : [y2, y1];
  return (hi + 0.05) / (lo + 0.05);
}

function chebyshev(data: ArrayLike<number>, i: number, c: Rgb): number {
  return Math.max(
    Math.abs(data[i] - c[0]),
    Math.abs(data[i + 1] - c[1]),
    Math.abs(data[i + 2] - c[2]),
  );
}

/**
 * PURE. Decide what may be removed from a logo, from its own pixels only.
 * Every branch that is not a proof returns "none" — refusing is always correct,
 * because the fallback is the owner's untouched asset.
 */
export function classifyLogoCanvas(s: LogoSample): LogoPlan {
  const { width: w, height: h, data } = s;
  if (w < SAMPLE_MIN_DIM || h < SAMPLE_MIN_DIM) return none("sample too small");
  const total = w * h;
  if (data.length < total * 4) return none("truncated sample");
  const at = (x: number, y: number) => (y * w + x) * 4;

  // 0. Already cut out. An owner who shipped alpha already told us where the
  //    background is; there is nothing to prove and nothing to improve.
  let transparent = 0;
  for (let i = 3; i < total * 4; i += 4) if (data[i] < ALPHA_OPAQUE_MIN) transparent += 1;
  if (s.declaredAlpha && transparent / total >= ALPHA_EXISTING_MIN) return { kind: "alpha" };

  // 1. The canvas colour, read off the four corners. A patch (not a single
  //    pixel) per corner so one dead pixel cannot name the background — but the
  //    check is PER SAMPLE, not on the four patch means: averaging a corner that
  //    straddles artwork would invent a colour present nowhere in the image.
  const patch = Math.max(1, Math.round(Math.min(w, h) * 0.03));
  const corner: number[] = [];
  for (const [ox, oy] of [
    [0, 0],
    [w - patch, 0],
    [0, h - patch],
    [w - patch, h - patch],
  ]) {
    for (let y = oy; y < oy + patch; y++) {
      for (let x = ox; x < ox + patch; x++) {
        const i = at(x, y);
        if (data[i + 3] < ALPHA_OPAQUE_MIN) {
          return none("transparent corner without declared alpha");
        }
        corner.push(i);
      }
    }
  }
  const canvas: Rgb = [0, 1, 2].map((c) =>
    Math.round(corner.reduce((a, i) => a + data[i + c], 0) / corner.length),
  ) as Rgb;
  for (const i of corner) {
    if (chebyshev(data, i, canvas) > CANVAS_CORNER_TOL) {
      return none("corners disagree — no single background colour");
    }
  }

  // 2. How much of the image IS that colour, and is the rest actually distinct?
  const isCanvas = new Uint8Array(total);
  let canvasCount = 0;
  let farFromCanvas = 0;
  let nonCanvas = 0;
  for (let p = 0; p < total; p++) {
    const i = p * 4;
    const d = chebyshev(data, i, canvas);
    if (data[i + 3] >= ALPHA_OPAQUE_MIN && d <= KEY_TOL) {
      isCanvas[p] = 1;
      canvasCount += 1;
    } else {
      nonCanvas += 1;
      if (d >= ARTWORK_SEPARATION_MIN) farFromCanvas += 1;
    }
  }
  const coverage = canvasCount / total;
  if (coverage < CANVAS_COVERAGE_MIN) return none("no background region to remove");
  if (coverage > CANVAS_COVERAGE_MAX) return none("background colour dominates the artwork");
  if (nonCanvas === 0 || farFromCanvas / nonCanvas < ARTWORK_SEPARATION_RATIO) {
    return none("background not distinct from the artwork");
  }

  // 3. DISC proof — the case in evidence. Circle inscribed in the short side.
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const r = Math.min(w - 1, h - 1) / 2;
  const rOut = r * (1 + DISC_ANNULUS);
  const rIn = r * (1 - DISC_ANNULUS);
  let outside = 0;
  let outsideCanvas = 0;
  let inside = 0;
  let insideCanvas = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.hypot(x - cx, y - cy);
      const p = y * w + x;
      if (d > rOut) {
        outside += 1;
        outsideCanvas += isCanvas[p];
      } else if (d < rIn) {
        inside += 1;
        insideCanvas += isCanvas[p];
      }
    }
  }
  if (
    outside > 0 &&
    inside > 0 &&
    outsideCanvas / outside >= DISC_OUTSIDE_CANVAS_MIN &&
    insideCanvas / inside <= DISC_INSIDE_CANVAS_MAX &&
    // `discAlpha` masks by radius alone, so anything non-canvas out here is
    // deleted sight-unseen. A speck is encoder noise; a blob is a wordmark.
    largestOutsideBlob(isCanvas, w, h, cx, cy, rOut) <= DISC_OUTSIDE_BLOB_MAX * total
  ) {
    return { kind: "disc", canvas };
  }

  // 4. KEY proof — uniform backdrop behind rectangular artwork.
  let ring = 0;
  let ringCanvas = 0;
  for (let x = 0; x < w; x++) {
    ring += 2;
    ringCanvas += isCanvas[x] + isCanvas[(h - 1) * w + x];
  }
  for (let y = 1; y < h - 1; y++) {
    ring += 2;
    ringCanvas += isCanvas[y * w] + isCanvas[y * w + (w - 1)];
  }
  if (ringCanvas / ring < BORDER_CANVAS_MIN) return none("border is not a uniform backdrop");

  const filled = floodFillBackground(isCanvas, w, h);
  const centre = Math.floor(cy) * w + Math.floor(cx);
  if (filled.reached[centre] === 1) return none("background fill reached the centre — it leaked");
  const filledRatio = filled.count / total;
  if (filledRatio < CANVAS_COVERAGE_MIN) return none("background is not connected to the border");
  if (filledRatio > CANVAS_COVERAGE_MAX) return none("background fill swallowed the artwork");

  // Connectivity proves the pixels are REACHABLE from the border. It does not
  // prove they are a BACKDROP: a solid badge with a knocked-out glyph is
  // border-connected too, and keying it deletes the badge. Two more measurements
  // before we are allowed to delete anything.
  if (relLuminance(canvas[0], canvas[1], canvas[2]) < KEY_CANVAS_LUMINANCE_MIN) {
    return none("canvas is the artwork's own fill");
  }
  let inkY = 0;
  let inkN = 0;
  for (let p = 0; p < total; p++) {
    if (filled.reached[p] === 1) continue;
    const i = p * 4;
    if (data[i + 3] < ALPHA_OPAQUE_MIN) continue;
    inkY += relLuminance(data[i], data[i + 1], data[i + 2]);
    inkN += 1;
  }
  const surfaceY = relLuminance(...CHROME_SURFACE_RGB);
  if (inkN === 0 || contrastRatio(inkY / inkN, surfaceY) < KEY_INK_CONTRAST_MIN) {
    return none("keying it would leave the mark invisible on the chrome surface");
  }
  return { kind: "key", canvas, fill: filledRatio };
}

/**
 * Size of the largest 4-connected run of NON-canvas pixels strictly outside
 * `rOut`. PURE. The disc mask cannot consult the pixels (it is analytic), so
 * this is the only place that can notice a mark living outside the circle.
 */
function largestOutsideBlob(
  isCanvas: Uint8Array,
  w: number,
  h: number,
  cx: number,
  cy: number,
  rOut: number,
): number {
  const total = w * h;
  const seen = new Uint8Array(total);
  const stack = new Int32Array(total);
  const candidate = (p: number) => {
    if (seen[p] === 1 || isCanvas[p] === 1) return false;
    const x = p % w;
    return Math.hypot(x - cx, (p - x) / w - cy) > rOut;
  };
  let largest = 0;
  for (let start = 0; start < total; start++) {
    if (!candidate(start)) continue;
    seen[start] = 1;
    stack[0] = start;
    let top = 1;
    let size = 0;
    while (top > 0) {
      const p = stack[--top];
      size += 1;
      const x = p % w;
      const y = (p - x) / w;
      const push = (n: number) => {
        if (candidate(n)) {
          seen[n] = 1;
          stack[top++] = n;
        }
      };
      if (x > 0) push(p - 1);
      if (x < w - 1) push(p + 1);
      if (y > 0) push(p - w);
      if (y < h - 1) push(p + w);
    }
    if (size > largest) largest = size;
  }
  return largest;
}

/**
 * 4-connected flood fill from every border pixel over the canvas mask. PURE.
 * Connectivity is the proof that a removed pixel is background and not a
 * same-coloured part of the mark.
 */
function floodFillBackground(
  isCanvas: Uint8Array,
  w: number,
  h: number,
): { reached: Uint8Array; count: number } {
  const reached = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  let top = 0;
  let count = 0;
  const push = (p: number) => {
    if (isCanvas[p] === 1 && reached[p] === 0) {
      reached[p] = 1;
      count += 1;
      stack[top++] = p;
    }
  };
  for (let x = 0; x < w; x++) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    push(y * w);
    push(y * w + (w - 1));
  }
  while (top > 0) {
    const p = stack[--top];
    const x = p % w;
    const y = (p - x) / w;
    if (x > 0) push(p - 1);
    if (x < w - 1) push(p + 1);
    if (y > 0) push(p - w);
    if (y < h - 1) push(p + w);
  }
  return { reached, count };
}

/**
 * Sample a logo's own pixels for the classifier. Nearest-neighbour so no blend
 * is invented; aspect preserved so the disc geometry stays honest.
 */
async function sampleLogo(buf: Buffer): Promise<LogoSample | null> {
  const sharp = (await import("sharp")).default;
  const meta = await sharp(buf).metadata();
  const { data, info } = await sharp(buf)
    .resize(SAMPLE_DIM, SAMPLE_DIM, { fit: "inside", withoutEnlargement: true, kernel: "nearest" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.channels !== 4) return null;
  return {
    width: info.width,
    height: info.height,
    data,
    declaredAlpha: meta.hasAlpha === true,
  };
}

/**
 * Classify `buf` and, when we proved something, return the adapted WebP with a
 * real alpha channel. `null` = ship the original (nothing proved, sharp absent,
 * or anything at all went wrong).
 */
export async function adaptLogoBuffer(buf: Buffer): Promise<{
  data: Buffer;
  plan: Extract<LogoPlan, { kind: "disc" | "key" }>;
  /** Mean CIE L* of the adapted mark's OPAQUE pixels — the mark's own ink. The
   *  chrome needs it because removing the canvas removes the contrast that came
   *  with it: a pale disc that read fine on black is invisible on a #fafafa nav,
   *  and only a measurement can tell the two cases apart (`brand.logoInkL` →
   *  `resolveDisplayLogo`). */
  inkL: number;
  /** Width ÷ height of the TRIMMED mark — the shape the chrome will lay out,
   *  which after the ink-box crop is no longer the source file's shape. */
  aspect: number;
} | null> {
  try {
    const sample = await sampleLogo(buf);
    if (!sample) return null;
    const plan = classifyLogoCanvas(sample);
    if (plan.kind !== "disc" && plan.kind !== "key") return null;

    const sharp = (await import("sharp")).default;
    const { data: rgb, info } = await sharp(buf)
      .resize(WORK_MAX_DIM, WORK_MAX_DIM, { fit: "inside", withoutEnlargement: true })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    if (info.channels !== 3) return null;
    const w = info.width;
    const h = info.height;

    const alpha =
      plan.kind === "disc"
        ? discAlpha(w, h)
        : await keyAlpha(rgb, w, h, plan.canvas, plan.fill, sharp);
    if (!alpha) return null;

    const inkL = meanInkL(rgb, alpha, w * h);
    if (inkL === null) return null;

    // Trim to the ink box. The removed canvas was also the mark's padding, and
    // transparent padding is dead space `object-fit: contain` still pays for.
    // Cropped HERE rather than with sharp's `.trim()`: sharp applies joinChannel
    // AFTER trim, so a trim in that pipeline would never see this alpha map at
    // all (measured — it returned the untrimmed 256² box).
    const box = inkBox(alpha, w, h);
    if (!box || box.w < w * TRIM_MIN_RATIO || box.h < h * TRIM_MIN_RATIO) return null;
    const rgbCrop = Buffer.allocUnsafe(box.w * box.h * 3);
    const alphaCrop = Buffer.allocUnsafe(box.w * box.h);
    for (let y = 0; y < box.h; y++) {
      const from = (box.y + y) * w + box.x;
      rgb.copy(rgbCrop, y * box.w * 3, from * 3, (from + box.w) * 3);
      alpha.copy(alphaCrop, y * box.w, from, from + box.w);
    }

    const out = await sharp(rgbCrop, { raw: { width: box.w, height: box.h, channels: 3 } })
      .joinChannel(alphaCrop, { raw: { width: box.w, height: box.h, channels: 1 } })
      .webp({ quality: OUT_QUALITY, alphaQuality: 100 })
      .toBuffer();
    return { data: out, plan, inkL, aspect: box.w / box.h };
  } catch (e) {
    console.warn("[media/logo] adaptation unavailable:", e instanceof Error ? e.message : e);
    return null;
  }
}

/** Bounding box of every pixel the alpha map keeps — the mark's ink box.
 *  `null` when nothing survives. */
function inkBox(
  alpha: Buffer,
  w: number,
  h: number,
): { x: number; y: number; w: number; h: number } | null {
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (alpha[y * w + x] === 0) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return x1 < x0 || y1 < y0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** Mean CIE L* over the pixels that SURVIVE the mask — the mark as it will
 *  actually be seen. `null` when nothing survives (there is no mark to ship). */
function meanInkL(rgb: Buffer, alpha: Buffer, total: number): number | null {
  let sum = 0;
  let n = 0;
  for (let p = 0; p < total; p++) {
    if (alpha[p] < ALPHA_OPAQUE_MIN) continue;
    const i = p * 3;
    sum += lStar(relLuminance(rgb[i], rgb[i + 1], rgb[i + 2]));
    n += 1;
  }
  return n === 0 ? null : sum / n;
}

/** Analytic circular alpha: opaque inside the inscribed circle, feathered out. */
function discAlpha(w: number, h: number): Buffer {
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const r = Math.min(w - 1, h - 1) / 2 - DISC_EDGE_INSET_PX;
  const alpha = Buffer.allocUnsafe(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const t = (r - Math.hypot(x - cx, y - cy)) / DISC_FEATHER_PX;
      alpha[y * w + x] = Math.round(Math.min(1, Math.max(0, t)) * 255);
    }
  }
  return alpha;
}

/**
 * Border-connected colour key. Grows the background by one pixel first: the
 * pixels immediately adjacent to the fill are part canvas by construction, and
 * leaving them opaque is exactly what a halo is.
 */
async function keyAlpha(
  rgb: Buffer,
  w: number,
  h: number,
  canvas: Rgb,
  /** The fill ratio the 64² sample proved (`LogoPlan.fill`). */
  sampledFill: number,
  sharp: SharpFactory,
): Promise<Buffer | null> {
  const total = w * h;
  const isCanvas = new Uint8Array(total);
  for (let p = 0; p < total; p++) {
    const i = p * 3;
    const d = Math.max(
      Math.abs(rgb[i] - canvas[0]),
      Math.abs(rgb[i + 1] - canvas[1]),
      Math.abs(rgb[i + 2] - canvas[2]),
    );
    if (d <= KEY_TOL) isCanvas[p] = 1;
  }
  const { reached, count } = floodFillBackground(isCanvas, w, h);
  // The full-resolution fill must agree with the sampled proof, and it gets the
  // SAME guards the classifier applied — the 64² sample skips 15 of every 16
  // source pixels, so a hairline gap in an outline is invisible there and wide
  // open here. Without these, a fill that leaks through it floods the interior
  // and the 90% ceiling is the only thing between us and deleting the artwork.
  if (reached[Math.floor((h - 1) / 2) * w + Math.floor((w - 1) / 2)] === 1) return null;
  const ratio = count / total;
  if (ratio > CANVAS_COVERAGE_MAX || ratio < CANVAS_COVERAGE_MIN) return null;
  if (ratio > sampledFill * KEY_FILL_DIVERGENCE_MAX) return null;

  const alpha = Buffer.allocUnsafe(total);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      let bg = reached[p] === 1;
      if (!bg) {
        for (let dy = -1; dy <= 1 && !bg; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            if (reached[ny * w + nx] === 1) {
              bg = true;
              break;
            }
          }
        }
      }
      alpha[p] = bg ? 0 : 255;
    }
  }
  // `toColourspace("b-w")` is load-bearing: sharp's default OUTPUT colourspace
  // is sRGB, so a blurred single-channel raw buffer comes back 3× too long and
  // joinChannel would then read a third of the image as the alpha map.
  const feathered = await sharp(alpha, { raw: { width: w, height: h, channels: 1 } })
    .blur(KEY_FEATHER_SIGMA)
    .toColourspace("b-w")
    .raw()
    .toBuffer({ resolveWithObject: true });
  return feathered.info.channels === 1 ? feathered.data : null;
}

/** `<dir>/<base>-mark.webp` for a storage object path — a pure function of the
 *  original, which is what makes producing it twice a no-op. */
function adaptedPathFor(path: string): string | null {
  if (!STORAGE_PATH_RE.test(path)) return null;
  const slash = path.lastIndexOf("/");
  const dir = path.slice(0, slash);
  const file = path.slice(slash + 1);
  const dot = file.lastIndexOf(".");
  const base = dot > 0 ? file.slice(0, dot) : file;
  // Never adapt an adapted mark: it already carries our alpha.
  if (base.endsWith(ADAPTED_SUFFIX)) return null;
  return `${dir}/${base}${ADAPTED_SUFFIX}.webp`;
}

/** What a caller persists on `tenants.brand` about the mark it will DISPLAY —
 *  which is the adapted asset when we produced one and the owner's original
 *  otherwise. Every field is optional because each is an independent
 *  measurement: any of them may be unavailable without invalidating the rest. */
export type AdaptedLogo = {
  /** → `brand.logoAdaptedUrl`. ABSENT when no adaptation was produced, which
   *  includes the case where none was NEEDED: an asset that already ships alpha
   *  has nothing to cut, yet still has ink worth measuring. */
  url?: string;
  /** → `brand.logoInkL`: mean CIE L* of the ink that will actually be seen.
   *  OPTIONAL because a mark reused from Storage is not re-decoded when it
   *  cannot be re-read; absent means "no chip", which is always safe EXCEPT for
   *  the case this field exists for — see `resolveDisplayLogo`. */
  inkL?: number;
  /** → `brand.logoAspect`: displayed width ÷ height of that same mark. The
   *  chrome reads it to tell a wordmark (the business name AS artwork) from an
   *  icon, because only one of the two may have the name printed beside it. */
  aspect?: number;
};

/**
 * Ink and shape of an asset we are NOT going to adapt — the already-transparent
 * case. Refusing to cut is right (there is nothing to prove), but refusing to
 * MEASURE is what left the standard "white version for dark headers" export
 * rendering as an empty slot on the light nav: no adaptation → no `inkL` → the
 * invisibility check never ran. Measured on the sample, over opaque pixels only.
 */
async function measureUncutLogo(buf: Buffer): Promise<{ inkL?: number; aspect?: number } | null> {
  try {
    const sample = await sampleLogo(buf);
    if (!sample) return null;
    const { width: w, height: h, data } = sample;
    const aspect = h > 0 ? w / h : undefined;
    if (classifyLogoCanvas(sample).kind !== "alpha") return { aspect };
    let sum = 0;
    let n = 0;
    for (let p = 0; p < w * h; p++) {
      const i = p * 4;
      if (data[i + 3] < ALPHA_OPAQUE_MIN) continue;
      sum += lStar(relLuminance(data[i], data[i + 1], data[i + 2]));
      n += 1;
    }
    return { aspect, ...(n > 0 ? { inkL: sum / n } : {}) };
  } catch {
    return null;
  }
}

/**
 * Produce (or reuse) the adapted mark for a stored logo and return its public
 * URL plus the measured ink — the values callers put on `brand`. `null` means
 * "no adapted asset": callers must then leave `logoAdaptedUrl` unset so the
 * render falls back to the owner's original (§brandLogoUrl).
 *
 * `bytes` lets the upload route hand over the buffer it already holds instead
 * of round-tripping it back out of Storage.
 */
export async function ensureAdaptedLogo(
  logoUrl: string,
  bytes?: Buffer,
): Promise<AdaptedLogo | null> {
  try {
    if (!isStorageUrl(logoUrl)) return null;
    const path = decodeURIComponent(logoUrl.slice(storagePublicPrefix().length).split("?")[0]);
    const adaptedPath = adaptedPathFor(path);
    if (!adaptedPath) return null;

    const { getServiceClient, isSupabaseConfigured } = await import("@/lib/supabase/server");
    if (!isSupabaseConfigured()) return null;
    const sb = getServiceClient();
    const store = sb.storage.from(BUCKET);
    const publicUrl = () => store.getPublicUrl(adaptedPath).data.publicUrl;

    // Idempotent: three call sites can ask for the same mark; derive it once.
    const slash = adaptedPath.lastIndexOf("/");
    const dir = adaptedPath.slice(0, slash);
    const name = adaptedPath.slice(slash + 1);
    const { data: listed } = await store.list(dir, { limit: 1, search: name });
    if (listed?.some((o) => o.name === name)) {
      // The mark is already derived; only its ink still has to be reported, and
      // that is a pure function of the (small, already-masked) file.
      return { url: publicUrl(), ...(await inkOfStored(store, adaptedPath)) };
    }

    let source = bytes;
    if (!source) {
      const { data: blob, error } = await store.download(path);
      if (error || !blob) return null;
      source = Buffer.from(await blob.arrayBuffer());
    }

    const adapted = await adaptLogoBuffer(source);
    // Nothing was cut — but "nothing to cut" and "nothing to know" are different
    // answers, and conflating them is what made a white-on-transparent wordmark
    // vanish on the light nav. Measure the asset we are about to display.
    if (!adapted) return await measureUncutLogo(source);

    const up = await store.upload(adaptedPath, adapted.data, {
      contentType: "image/webp",
      upsert: true,
    });
    if (up.error) {
      console.warn("[media/logo] adapted upload failed:", up.error.message);
      return null;
    }
    return { url: publicUrl(), inkL: adapted.inkL, aspect: adapted.aspect };
  } catch (e) {
    console.warn("[media/logo] ensureAdaptedLogo failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

/** Mean ink L* and shape of an already-derived mark. Fail-open in every
 *  direction: an unreadable file yields `{}`, i.e. no chip and no wordmark
 *  treatment — today's rendering, never a lost adaptation. */
async function inkOfStored(
  store: { download: (p: string) => Promise<{ data: Blob | null; error: unknown }> },
  path: string,
): Promise<{ inkL?: number; aspect?: number }> {
  try {
    const { data: blob, error } = await store.download(path);
    if (error || !blob) return {};
    const sharp = (await import("sharp")).default;
    const { data, info } = await sharp(Buffer.from(await blob.arrayBuffer()))
      .resize(SAMPLE_DIM, SAMPLE_DIM, { fit: "inside", withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    if (info.channels !== 4) return {};
    const aspect = info.height > 0 ? info.width / info.height : undefined;
    let sum = 0;
    let n = 0;
    for (let p = 0; p < info.width * info.height; p++) {
      const i = p * 4;
      if (data[i + 3] < ALPHA_OPAQUE_MIN) continue;
      sum += lStar(relLuminance(data[i], data[i + 1], data[i + 2]));
      n += 1;
    }
    return { aspect, ...(n > 0 ? { inkL: sum / n } : {}) };
  } catch {
    return {};
  }
}
