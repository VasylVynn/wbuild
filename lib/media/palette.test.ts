import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { aggregatePalette, extractLogoPalette, extractPalette } from "./palette";
import { sanitizeMedia, siteScopedPhotoMeta, type PhotoMeta } from "./media";

/**
 * Palette grounding (pipeline v2 §3-S0, wave V1). Three contracts under test:
 *  - aggregatePalette is pure and deterministic: weighting, exclusions and tie
 *    order must be reproducible without sharp or env;
 *  - the palette field survives the two schema paths (photoMetaSchema through
 *    sanitizeMedia, and the siteScopedPhotoMeta whitelist) — a palette written
 *    at import time must reach regeneration;
 *  - extraction over real pixels is deterministic (skip-guarded: sharp is a
 *    native module the test env may not have).
 */

const meta = (url: string, extra: Partial<PhotoMeta> = {}): PhotoMeta => ({ url, ...extra });

describe("aggregatePalette — weighting", () => {
  it("lets a higher-scoring photo's colors lead", () => {
    const out = aggregatePalette([
      meta("a", { siteQuality: 3, palette: ["#111111"] }),
      meta("b", { siteQuality: 9, palette: ["#222222"] }),
    ]);
    // Photo a: score 3 < threshold 4 → excluded entirely.
    expect(out).toEqual(["#222222"]);
  });

  it("weights by photoScore so a stronger photo's lead color wins", () => {
    const out = aggregatePalette([
      meta("a", { siteQuality: 9, palette: ["#aa0000", "#0000aa"] }),
      meta("b", { siteQuality: 5, palette: ["#00aa00"] }),
    ]);
    expect(out[0]).toBe("#aa0000"); // 9 > 5
    expect(out).toContain("#00aa00");
  });

  it("boosts hero-candidates over an equally-scored ordinary photo", () => {
    const out = aggregatePalette([
      meta("plain", { siteQuality: 6, palette: ["#123456"] }),
      meta("hero", { siteQuality: 6, heroCandidate: true, palette: ["#654321"] }),
    ]);
    expect(out[0]).toBe("#654321");
  });

  it("accumulates the same hex across photos", () => {
    const out = aggregatePalette([
      meta("a", { siteQuality: 5, palette: ["#ff0000", "#00ff00"] }),
      meta("b", { siteQuality: 5, palette: ["#ff0000", "#0000ff"] }),
      meta("c", { siteQuality: 9, palette: ["#00ff00"] }),
    ]);
    // #00ff00: 5/2 (2nd slot in a) + 9 (lead in c) = 11.5
    // #ff0000: 5 + 5 (lead in a and b)             = 10
    expect(out[0]).toBe("#00ff00");
    expect(out[1]).toBe("#ff0000");
  });

  it("normalizes hex case when accumulating", () => {
    const out = aggregatePalette([
      meta("a", { siteQuality: 5, palette: ["#AABBCC"] }),
      meta("b", { siteQuality: 5, palette: ["#aabbcc"] }),
    ]);
    expect(out).toEqual(["#aabbcc"]);
  });
});

describe("aggregatePalette — exclusions", () => {
  it("excludes generated/ imagery, hidden/text_source roles and low scores", () => {
    const out = aggregatePalette([
      meta("https://x.co/storage/v1/object/public/photos/generated/a.webp", {
        siteQuality: 10,
        palette: ["#111111"],
      }),
      meta("hidden", { role: "hidden", siteQuality: 10, palette: ["#222222"] }),
      meta("info", { role: "text_source", siteQuality: 10, palette: ["#333333"] }),
      meta("notsite", { useOnSite: false, siteQuality: 10, palette: ["#444444"] }),
      meta("bad", { siteQuality: 2, palette: ["#555555"] }),
      meta("nopalette", { siteQuality: 10 }),
      meta("good", { siteQuality: 7, palette: ["#666666"] }),
    ]);
    expect(out).toEqual(["#666666"]);
  });

  it("a warning-penalized photo drops below the floor", () => {
    // score 5 - 2 (blur warning) = 3 < 4 → out.
    const out = aggregatePalette([
      meta("blurry", {
        siteQuality: 5,
        warnings: ["Фото трохи розмите — перевірте різкість"],
        palette: ["#777777"],
      }),
    ]);
    expect(out).toEqual([]);
  });

  it("keeps the logo despite useOnSite=false and boosts it above photos", () => {
    const out = aggregatePalette([
      meta("logo", { kind: "logo", useOnSite: false, palette: ["#c0ffee"] }),
      meta("photo", { siteQuality: 9, palette: ["#deadaf"] }),
    ]);
    // logo: score 5 (unrated) × 3 = 15 beats photo 9.
    expect(out[0]).toBe("#c0ffee");
    expect(out[1]).toBe("#deadaf");
  });

  it("returns [] for empty input and caps at 6 colors", () => {
    expect(aggregatePalette([])).toEqual([]);
    const many = meta("a", {
      siteQuality: 8,
      palette: ["#000001", "#000002", "#000003", "#000004", "#000005", "#000006"],
    });
    const more = meta("b", { siteQuality: 5, palette: ["#000007", "#000008"] });
    expect(aggregatePalette([many, more])).toHaveLength(6);
  });

  it("is deterministic: identical input twice gives identical output", () => {
    const input = [
      meta("a", { siteQuality: 6, palette: ["#101010", "#202020"] }),
      meta("b", { siteQuality: 6, heroCandidate: true, palette: ["#303030"] }),
      meta("c", { kind: "logo" as const, palette: ["#404040"] }),
    ];
    expect(aggregatePalette(input)).toEqual(aggregatePalette(input));
  });
});

// ── schema round-trips (env-dependent: storage prefix from NEXT_PUBLIC_SUPABASE_URL) ──

const SUPABASE_URL = "https://proj.supabase.co";
const good = (name: string) => `${SUPABASE_URL}/storage/v1/object/public/photos/t/${name}.webp`;
const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
});
afterAll(() => {
  if (prevUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = prevUrl;
});

describe("palette schema round-trip", () => {
  it("survives photoMetaSchema via sanitizeMedia", () => {
    const out = sanitizeMedia({
      photos: [good("a")],
      photoMeta: [{ url: good("a"), kind: "work", palette: ["#aabbcc", "#112233"] }],
    });
    expect(out.photoMeta?.[0].palette).toEqual(["#aabbcc", "#112233"]);
  });

  it("drops a malformed palette but KEEPS the meta entry (fail-open .catch)", () => {
    const out = sanitizeMedia({
      photos: [good("a")],
      photoMeta: [{ url: good("a"), kind: "work", siteQuality: 7, palette: ["not-a-hex"] }],
    });
    expect(out.photoMeta).toHaveLength(1);
    expect(out.photoMeta?.[0].palette).toBeUndefined();
    expect(out.photoMeta?.[0].siteQuality).toBe(7);
  });

  it("rides the siteScopedPhotoMeta whitelist onto brand", () => {
    const out = siteScopedPhotoMeta({
      photos: [good("a")],
      photoMeta: [
        { url: good("a"), kind: "work", palette: ["#aabbcc"], ocrText: "dossier-only bulk" },
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0].palette).toEqual(["#aabbcc"]);
    expect(out[0].ocrText).toBeUndefined();
  });
});

// ── extraction determinism (needs sharp — a native module; skip when absent) ──

let sharpAvailable = true;
try {
  await import("sharp");
} catch {
  sharpAvailable = false;
}

describe.skipIf(!sharpAvailable)("extractPalette — deterministic over real pixels", () => {
  /** 16×16 PNG: left half red, right half teal. */
  async function twoColorPng(): Promise<Buffer> {
    const sharp = (await import("sharp")).default;
    const w = 16;
    const h = 16;
    const raw = Buffer.alloc(w * h * 3);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 3;
        if (x < w / 2) raw[i] = 0xff; // red
        else {
          raw[i + 1] = 0x80; // teal-ish
          raw[i + 2] = 0x80;
        }
      }
    }
    return sharp(raw, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
  }

  it("returns the same palette for the same bytes, containing the real colors", async () => {
    const png = await twoColorPng();
    const first = await extractPalette(png);
    const second = await extractPalette(png);
    expect(first).not.toBeNull();
    expect(first).toEqual(second);
    expect(first).toContain("#ff0000");
    expect(first).toContain("#008080");
    for (const hex of first!) expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    expect(first!.length).toBeLessThanOrEqual(6);
  });

  it("ignores the transparent background of a logo (alpha-aware)", async () => {
    const sharp = (await import("sharp")).default;
    const w = 16;
    const h = 16;
    const raw = Buffer.alloc(w * h * 4); // all transparent black
    for (let y = 4; y < 12; y++) {
      for (let x = 4; x < 12; x++) {
        const i = (y * w + x) * 4;
        raw[i] = 0x11; // near-black mark
        raw[i + 1] = 0x11;
        raw[i + 2] = 0x11;
        raw[i + 3] = 0xff;
      }
    }
    const png = await sharp(raw, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
    const palette = await extractLogoPalette(png);
    expect(palette).not.toBeNull();
    // Only the opaque mark's color — the transparent background contributes
    // nothing, and the grayscale filter is off so no Google-Blue fallback.
    expect(palette).toEqual(["#111111"]);
  });

  it("fails open to null on undecodable bytes", async () => {
    expect(await extractPalette(Buffer.from("not an image"))).toBeNull();
  });
});
