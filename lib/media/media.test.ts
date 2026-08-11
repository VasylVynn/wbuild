import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  draftPhotoUrls,
  MAX_PHOTOS,
  sanitizeMedia,
  siteScopedPhotoMeta,
  type PhotoMeta,
} from "./media";

/**
 * sanitizeMedia drops PER ITEM (plan «якість генерації» §1.4). The regression it
 * exists for: one URL that no longer matches the storage prefix used to collapse
 * the whole object to `{ photos: [] }`, erasing a site's entire photo set and
 * then triggering AI image generation to "fix" the emptiness.
 *
 * The storage prefix is derived from NEXT_PUBLIC_SUPABASE_URL at call time, so
 * these tests set it rather than mocking the guard.
 */

const SUPABASE_URL = "https://proj.supabase.co";
const good = (name: string) => `${SUPABASE_URL}/storage/v1/object/public/photos/t/${name}.webp`;
const foreign = "https://instagram.fkiv.example/photo.jpg";

let warnSpy: ReturnType<typeof vi.spyOn>;
const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
  // The drops are logged on purpose (that is the diagnostic this wave adds) —
  // silence the sink, keep the spy to prove the logging happens.
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => warnSpy.mockClear());

afterAll(() => {
  warnSpy.mockRestore();
  if (prevUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = prevUrl;
});

describe("sanitizeMedia — valid input", () => {
  it("passes a fully valid object through untouched", () => {
    const input = {
      logoUrl: good("logo"),
      photos: [good("a"), good("b")],
      generatedHero: good("hero"),
      photoMeta: [{ url: good("a"), kind: "work", siteQuality: 8, heroCandidate: true }],
    };
    const out = sanitizeMedia(input);
    expect(out.photos).toEqual([good("a"), good("b")]);
    expect(out.logoUrl).toBe(good("logo"));
    expect(out.generatedHero).toBe(good("hero"));
    expect(out.photoMeta?.[0]).toMatchObject({ siteQuality: 8, heroCandidate: true });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("keeps unknown meta fields (passthrough) so a later wave survives a DB round trip", () => {
    const out = sanitizeMedia({
      photos: [good("a")],
      photoMeta: [{ url: good("a"), somethingNew: "keep me" }],
    });
    expect(out.photoMeta?.[0]).toMatchObject({ somethingNew: "keep me" });
  });
});

describe("sanitizeMedia — mixed valid and invalid", () => {
  it("drops only the foreign photo and keeps the rest", () => {
    const out = sanitizeMedia({ photos: [good("a"), foreign, good("b")] });
    expect(out.photos).toEqual([good("a"), good("b")]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it("keeps the photos when the LOGO is the invalid field", () => {
    const out = sanitizeMedia({ logoUrl: foreign, photos: [good("a"), good("b")] });
    expect(out.logoUrl).toBeUndefined();
    expect(out.photos).toEqual([good("a"), good("b")]);
  });

  it("keeps valid meta entries when a sibling entry is malformed", () => {
    const out = sanitizeMedia({
      photos: [good("a")],
      photoMeta: [
        { url: foreign, kind: "work" },
        { url: good("a"), kind: "work", siteQuality: 7 },
        { url: good("b"), kind: "not-a-kind" },
        "nonsense",
      ],
    });
    expect(out.photoMeta?.map((m) => m.url)).toEqual([good("a")]);
    expect(warnSpy).toHaveBeenCalledTimes(3);
  });

  it("still caps photos at MAX_PHOTOS on the salvage path", () => {
    const many = Array.from({ length: MAX_PHOTOS + 5 }, (_, i) => good(`p${i}`));
    const out = sanitizeMedia({ logoUrl: foreign, photos: many });
    expect(out.photos).toHaveLength(MAX_PHOTOS);
  });

  it("tolerates a photos field that is not an array at all", () => {
    const out = sanitizeMedia({ photos: "oops", logoUrl: good("logo") });
    expect(out.photos).toEqual([]);
    expect(out.logoUrl).toBe(good("logo"));
  });
});

describe("sanitizeMedia — nothing salvageable", () => {
  it("returns an empty set for non-objects and for an all-foreign set", () => {
    expect(sanitizeMedia(null)).toEqual({ photos: [] });
    expect(sanitizeMedia("https://example.com")).toEqual({ photos: [] });
    expect(sanitizeMedia({ photos: [foreign, foreign] })).toEqual({ photos: [] });
  });
});

describe("siteScopedPhotoMeta", () => {
  it("keeps the rendered photos' signals and drops the dossier-only bulk", () => {
    const meta: PhotoMeta[] = [
      {
        url: good("a"),
        id: "abc",
        kind: "work",
        alt: "Букет півоній",
        siteQuality: 8,
        heroCandidate: true,
        ocrText: "x".repeat(3000),
        extractedInfo: { phones: ["+380"], prices: [], addresses: [], promos: [] },
        sourceCaption: "c".repeat(500),
      },
      { url: good("price"), kind: "menu", role: "text_source", ocrText: "прайс" },
    ];
    const out = siteScopedPhotoMeta({ photos: [good("a")], logoUrl: good("logo"), photoMeta: meta });

    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ url: good("a"), siteQuality: 8, heroCandidate: true, alt: "Букет півоній" });
    expect(out[0].ocrText).toBeUndefined();
    expect(out[0].extractedInfo).toBeUndefined();
    expect(out[0].sourceCaption).toHaveLength(200);
  });

  it("keeps the logo's meta and returns nothing when there is none", () => {
    const meta: PhotoMeta[] = [{ url: good("logo"), kind: "logo" }];
    expect(siteScopedPhotoMeta({ photos: [], logoUrl: good("logo"), photoMeta: meta })).toHaveLength(1);
    expect(siteScopedPhotoMeta({ photos: [good("a")] })).toEqual([]);
    expect(siteScopedPhotoMeta(undefined)).toEqual([]);
  });
});

describe("draftPhotoUrls — the owner's curated photos win a regeneration", () => {
  const stored = (n: string) => `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos/${n}.jpg`;

  it("finds every storage image the draft shows, in document order, once each", () => {
    const blocks = [
      { type: "hero", props: { imageUrl: stored("a"), title: "x" } },
      { type: "gallery", props: { items: [{ url: stored("b") }, { url: stored("a") }] } },
      { type: "services", props: { items: [{ name: "s", photo: stored("c") }] } },
    ];
    expect(draftPhotoUrls(blocks)).toEqual([stored("a"), stored("b"), stored("c")]);
  });

  it("refuses foreign URLs (invariant 1) and survives junk", () => {
    const blocks = [
      { type: "hero", props: { imageUrl: "https://cdn.example.com/x.jpg" } },
      { type: "text", props: { body: "просто текст", n: 4, ok: true, nested: null } },
    ];
    expect(draftPhotoUrls(blocks)).toEqual([]);
    expect(draftPhotoUrls(undefined)).toEqual([]);
    expect(draftPhotoUrls("nonsense")).toEqual([]);
  });
});
