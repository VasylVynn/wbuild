import { describe, expect, it } from "vitest";
import { classifyLogoCanvas, type LogoSample, type Rgb } from "./logo";

/**
 * The classifier is PURE over sampled pixels, so these run in the node-only
 * vitest environment with no sharp and no fixtures. The numbers in
 * `tennisBadge` are the ones measured off the live asset
 * (san-team-tennis-2 → brand.logoUrl, 1080×1080, 3 channels, hasAlpha false):
 * corners (0,0,0); edge midpoints [229,244,250] / [177,224,242] /
 * [248,245,180] / [174,224,241]; centre [174,225,246]; near-black 20.0%.
 */

const DIM = 64;

function blank(w = DIM, h = DIM, declaredAlpha = false): LogoSample & { data: Uint8Array } {
  return { width: w, height: h, data: new Uint8Array(w * h * 4), declaredAlpha };
}

function set(s: { width: number; data: Uint8Array }, x: number, y: number, rgba: number[]) {
  const i = (y * s.width + x) * 4;
  s.data[i] = rgba[0];
  s.data[i + 1] = rgba[1];
  s.data[i + 2] = rgba[2];
  s.data[i + 3] = rgba[3] ?? 255;
}

function get(s: { width: number; data: Uint8Array }, x: number, y: number): number[] {
  const i = (y * s.width + x) * 4;
  return [s.data[i], s.data[i + 1], s.data[i + 2], s.data[i + 3]];
}

/** A circular badge inscribed in an opaque canvas — the shape in evidence. */
function badgeOnCanvas(canvas: Rgb, disc: (x: number, y: number) => Rgb, noise = 0) {
  const s = blank();
  const c = (DIM - 1) / 2;
  // Radius = half the SIDE, so the disc touches each edge midpoint exactly as
  // the measured asset does (its edge midpoints are artwork colours).
  const r = DIM / 2;
  let seed = 1;
  const jitter = () => {
    if (noise === 0) return 0;
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed % (noise + 1);
  };
  for (let y = 0; y < DIM; y++) {
    for (let x = 0; x < DIM; x++) {
      const inside = Math.hypot(x - c, y - c) <= r;
      const px = inside ? disc(x, y) : canvas.map((v) => Math.min(255, v + jitter()));
      set(s, x, y, [px[0], px[1], px[2], 255]);
    }
  }
  return s;
}

/** The measured artwork: a light blue/cyan field with a yellow arc up top. */
const tennisDisc = (x: number, y: number): Rgb =>
  y < DIM * 0.22 && x > DIM * 0.3 && x < DIM * 0.7 ? [248, 245, 180] : [174, 225, 246];

describe("classifyLogoCanvas — the tennis badge (measured asset)", () => {
  const s = badgeOnCanvas([0, 0, 0], tennisDisc);

  it("reproduces the measured samples: black corners, artwork edge midpoints", () => {
    expect(get(s, 0, 0).slice(0, 3)).toEqual([0, 0, 0]);
    expect(get(s, DIM - 1, 0).slice(0, 3)).toEqual([0, 0, 0]);
    expect(get(s, 0, DIM - 1).slice(0, 3)).toEqual([0, 0, 0]);
    expect(get(s, DIM - 1, DIM - 1).slice(0, 3)).toEqual([0, 0, 0]);
    // Edge midpoints sit ON the inscribed circle → artwork, not canvas.
    expect(get(s, DIM - 1, DIM / 2).slice(0, 3)).toEqual([174, 225, 246]);
    expect(get(s, DIM / 2, DIM - 1).slice(0, 3)).toEqual([174, 225, 246]);
    expect(get(s, DIM / 2, DIM / 2).slice(0, 3)).toEqual([174, 225, 246]);
  });

  it("has ~20% near-black pixels — the area of a square outside its inscribed circle", () => {
    let black = 0;
    for (let i = 0; i < DIM * DIM; i++) {
      if (s.data[i * 4] < 24 && s.data[i * 4 + 1] < 24 && s.data[i * 4 + 2] < 24) black += 1;
    }
    const ratio = black / (DIM * DIM);
    expect(ratio).toBeGreaterThan(0.18);
    expect(ratio).toBeLessThan(0.23);
  });

  it("is classified as a disc on a black canvas", () => {
    const plan = classifyLogoCanvas(s);
    expect(plan.kind).toBe("disc");
    if (plan.kind === "disc") expect(plan.canvas).toEqual([0, 0, 0]);
  });

  it("survives encoder noise on the canvas (why the tolerance is 16/24, not 0)", () => {
    expect(classifyLogoCanvas(badgeOnCanvas([0, 0, 0], tennisDisc, 14)).kind).toBe("disc");
  });

  it("also reads a disc on a WHITE canvas — the defect is the canvas, not black", () => {
    const plan = classifyLogoCanvas(badgeOnCanvas([255, 255, 255], () => [12, 90, 60]));
    expect(plan.kind).toBe("disc");
    if (plan.kind === "disc") expect(plan.canvas).toEqual([255, 255, 255]);
  });
});

describe("classifyLogoCanvas — counter-cases it must refuse or pass through", () => {
  it("leaves an already-transparent PNG alone", () => {
    const s = blank(DIM, DIM, true);
    const c = (DIM - 1) / 2;
    for (let y = 0; y < DIM; y++) {
      for (let x = 0; x < DIM; x++) {
        const inside = Math.hypot(x - c, y - c) <= DIM * 0.3;
        set(s, x, y, inside ? [20, 120, 90, 255] : [0, 0, 0, 0]);
      }
    }
    expect(classifyLogoCanvas(s).kind).toBe("alpha");
  });

  it("refuses a photo-like logo with no uniform background", () => {
    const s = blank();
    for (let y = 0; y < DIM; y++) {
      for (let x = 0; x < DIM; x++) {
        set(s, x, y, [(x * 4) % 256, (y * 4) % 256, ((x + y) * 3) % 256, 255]);
      }
    }
    const plan = classifyLogoCanvas(s);
    expect(plan.kind).toBe("none");
    if (plan.kind === "none") expect(plan.reason).toMatch(/corners disagree/);
  });

  it("refuses a dark mark on a black canvas rather than eat the mark", () => {
    // Disc colour sits inside KEY_TOL of the canvas: "background" would swallow
    // the artwork, so nothing may be removed.
    const plan = classifyLogoCanvas(badgeOnCanvas([0, 0, 0], () => [14, 16, 18]));
    expect(plan.kind).toBe("none");
  });

  /**
   * `discAlpha` masks by RADIUS ALONE — it never looks at the pixels again — so
   * anything the proof tolerates outside the circle is artwork deleted
   * sight-unseen. A corner wordmark, an ®, an "EST. 1998" strip: the classifier
   * is the only place that can save them.
   */
  it("refuses a disc when real artwork sits OUTSIDE the inscribed circle", () => {
    const s = badgeOnCanvas([0, 0, 0], tennisDisc);
    // A pale block in the bottom-left corner region, clear of the 2×2 corner
    // patches (x 0–1, y 62–63) so this is caught by the geometry, not by the
    // corner test.
    for (let y = 54; y < 62; y++) {
      for (let x = 2; x < 10; x++) set(s, x, y, [230, 230, 230, 255]);
    }
    expect(classifyLogoCanvas(s).kind).toBe("none");
  });

  it("still passes a speck out there — encoder noise is not a wordmark", () => {
    const s = badgeOnCanvas([0, 0, 0], tennisDisc);
    set(s, 3, 60, [200, 200, 200, 255]);
    set(s, 4, 60, [200, 200, 200, 255]);
    expect(classifyLogoCanvas(s).kind).toBe("disc");
  });

  it("refuses when the canvas colour barely appears (a full-bleed mark)", () => {
    const s = blank();
    for (let y = 0; y < DIM; y++) {
      for (let x = 0; x < DIM; x++) {
        const edge = x < 1 || y < 1 || x > DIM - 2 || y > DIM - 2;
        set(s, x, y, edge ? [255, 255, 255, 255] : [30, 60, 140, 255]);
      }
    }
    // The corner patches straddle the 1px ring and the mark, so no single
    // background colour can be named — refusing is the only honest answer.
    expect(classifyLogoCanvas(s).kind).toBe("none");
  });
});

describe("classifyLogoCanvas — keyed rectangular artwork", () => {
  /** A light-canvas wordmark: exactly the asset that disappears on a dark nav. */
  function wordmarkOnCanvas(canvas: Rgb, ink: Rgb, extra?: (s: ReturnType<typeof blank>) => void) {
    const s = blank();
    for (let y = 0; y < DIM; y++) {
      for (let x = 0; x < DIM; x++) set(s, x, y, [canvas[0], canvas[1], canvas[2], 255]);
    }
    for (let y = 20; y < 44; y++) {
      for (let x = 8; x < 56; x++) set(s, x, y, [ink[0], ink[1], ink[2], 255]);
    }
    extra?.(s);
    return s;
  }

  it("keys a white canvas out from behind a dark wordmark", () => {
    const plan = classifyLogoCanvas(wordmarkOnCanvas([255, 255, 255], [16, 72, 48]));
    expect(plan.kind).toBe("key");
    if (plan.kind === "key") expect(plan.canvas).toEqual([255, 255, 255]);
  });

  it("keeps canvas-coloured pixels ENCLOSED by the mark (the counter of an 'O')", () => {
    // The hole is canvas-coloured but unreachable from the border, so the fill
    // never touches it — this is the whole reason the key is connectivity-based.
    const plan = classifyLogoCanvas(
      wordmarkOnCanvas([255, 255, 255], [16, 72, 48], (s) => {
        for (let y = 28; y < 36; y++) {
          for (let x = 28; x < 36; x++) set(s, x, y, [255, 255, 255, 255]);
        }
      }),
    );
    expect(plan.kind).toBe("key");
  });

  /**
   * The key's dangerous twin. Nothing in the pixels distinguishes "wordmark on
   * paper" from "solid badge with a knocked-out glyph" — both are a uniform,
   * border-connected colour around ink — but keying the second one deletes the
   * badge and leaves white ink on a cream nav. The proof therefore also demands
   * that the canvas LOOK like a backdrop and that what survives still reads.
   */
  it("refuses a solid navy badge — the canvas is the artwork's own fill", () => {
    const plan = classifyLogoCanvas(wordmarkOnCanvas([18, 34, 84], [255, 255, 255]));
    expect(plan.kind).toBe("none");
    if (plan.kind === "none") expect(plan.reason).toMatch(/artwork's own fill/);
  });

  it("refuses a pale mark on white — keying it would leave nothing visible", () => {
    const plan = classifyLogoCanvas(wordmarkOnCanvas([255, 255, 255], [240, 238, 150]));
    expect(plan.kind).toBe("none");
    if (plan.kind === "none") expect(plan.reason).toMatch(/invisible/);
  });

  it("refuses when the border is not one colour", () => {
    const s = wordmarkOnCanvas([255, 255, 255], [16, 72, 48]);
    // Inset so the corner patches stay pure white: this must be caught by the
    // border-ring test, not by the corner test.
    for (let x = 4; x < DIM - 4; x++) set(s, x, DIM - 1, [200, 30, 30, 255]);
    const plan = classifyLogoCanvas(s);
    expect(plan.kind).toBe("none");
    if (plan.kind === "none") expect(plan.reason).toMatch(/border is not a uniform backdrop/);
  });
});

/**
 * REGRESSION — the disc's own edge is what the proof has to survive. Every
 * fixture above draws a hard, exactly-inscribed circle, so the whole suite
 * passed while the REAL 1080² asset was refused: a rasterised edge is not a
 * step function, and its blended ring left ~4% of the disc's own rim counted
 * as "artwork outside the circle", tripping the 0.99 gate. Measured on the
 * live file: outside-canvas ratio 0.9621 at an annulus of ±2%, 1.0000 at ±4%
 * — which is why DISC_ANNULUS is 0.04.
 */
describe("classifyLogoCanvas — a rasterised (anti-aliased) disc", () => {
  /** The badge drawn the way a rasteriser draws it: per-pixel coverage by 4×4
   *  supersampling, blended toward the canvas colour. That yields one thin
   *  partial ring at the boundary — the thing a hard-edged fixture never has. */
  function rasterisedBadge(canvas: Rgb) {
    const s = blank();
    const c = (DIM - 1) / 2;
    const r = DIM / 2;
    const SS = 4;
    for (let y = 0; y < DIM; y++) {
      for (let x = 0; x < DIM; x++) {
        let hits = 0;
        for (let sy = 0; sy < SS; sy++) {
          for (let sx = 0; sx < SS; sx++) {
            const px = x + (sx + 0.5) / SS - 0.5;
            const py = y + (sy + 0.5) / SS - 0.5;
            if (Math.hypot(px - c, py - c) <= r) hits += 1;
          }
        }
        const t = hits / (SS * SS);
        const ink = tennisDisc(x, y);
        const px = ink.map((v, i) => Math.round(canvas[i] + (v - canvas[i]) * t)) as Rgb;
        set(s, x, y, [px[0], px[1], px[2], 255]);
      }
    }
    return s;
  }

  it("proves the disc despite the blended boundary ring", () => {
    expect(classifyLogoCanvas(rasterisedBadge([0, 0, 0])).kind).toBe("disc");
  });

  it("still refuses a wordmark sitting outside the circle", () => {
    const s = rasterisedBadge([0, 0, 0]);
    // A legible strip in the bottom-right corner — outside the disc, far from
    // the canvas colour, and connected: the blob guard must catch it.
    for (let y = DIM - 6; y < DIM - 2; y++) {
      for (let x = DIM - 14; x < DIM - 2; x++) set(s, x, y, [240, 240, 240, 255]);
    }
    expect(classifyLogoCanvas(s).kind).toBe("none");
  });
});
