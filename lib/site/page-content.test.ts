import { describe, it, expect } from "vitest";
import { publishedFromDraft, type PageContent } from "@/lib/site/page-content";

// 2026-08-13 incident + 2026-08-18 pre-deploy review: the deferred image job
// died (platform killed the after() callback) and the published copy kept
// `pendingImages` forever — permanent shimmer boxes on the LIVE gallery. The
// projection strips them, and a pending gallery left below assemble's
// ≥2-image floor is dropped whole (a bare «Наша атмосфера» heading over an
// empty grid must never publish). The draft keeps its shimmer for the job.
describe("publishedFromDraft", () => {
  const draft = (galleryProps: Record<string, unknown>): PageContent =>
    ({
      genToken: "g1",
      contentRev: 7,
      pocket: [],
      blocks: [
        { type: "hero", props: { title: "Т" } },
        { type: "gallery", props: galleryProps },
        { type: "contacts", props: {} },
      ],
    }) as unknown as PageContent;

  const img = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      url: `https://x/storage/v1/object/public/photos/${i}.jpg`,
    }));

  it("strips pendingImages but keeps a gallery at or above the 2-image floor", () => {
    const out = publishedFromDraft(
      draft({ title: "Атмосфера", images: img(2), pendingImages: 4 }),
    );
    const gal = (out.blocks ?? []).find((b) => b.type === "gallery");
    expect(gal).toBeDefined();
    expect((gal!.props as { pendingImages?: number }).pendingImages).toBeUndefined();
    expect((gal!.props as { images?: unknown[] }).images).toHaveLength(2);
    expect((gal!.props as { title?: string }).title).toBe("Атмосфера");
  });

  it("drops a pending gallery left EMPTY — never a bare heading on live", () => {
    const out = publishedFromDraft(
      draft({ title: "Наша атмосфера", images: [], pendingImages: 4 }),
    );
    expect((out.blocks ?? []).some((b) => b.type === "gallery")).toBe(false);
    // the neighbours survive
    expect(out.blocks?.map((b) => b.type)).toEqual(["hero", "contacts"]);
  });

  it("drops a pending gallery below the floor (1 image)", () => {
    const out = publishedFromDraft(
      draft({ title: "Наша атмосфера", images: img(1), pendingImages: 3 }),
    );
    expect((out.blocks ?? []).some((b) => b.type === "gallery")).toBe(false);
  });

  it("never touches a gallery without pendingImages, even a small one", () => {
    const d = draft({ title: "Наші роботи", images: img(1) });
    const out = publishedFromDraft(d);
    const gal = (out.blocks ?? []).find((b) => b.type === "gallery");
    expect(gal).toBeDefined();
    expect((gal!.props as { images?: unknown[] }).images).toHaveLength(1);
  });

  it("leaves the draft itself alone and strips draft-only keys", () => {
    const d = draft({ title: "Атмосфера", images: img(2), pendingImages: 4 });
    const out = publishedFromDraft(d);
    expect(out.blocks?.[0]).toBe(d.blocks?.[0]); // untouched reference
    expect("pocket" in out).toBe(false);
    expect("contentRev" in out).toBe(false);
    const draftGal = (d.blocks ?? []).find((b) => b.type === "gallery");
    expect((draftGal!.props as { pendingImages?: number }).pendingImages).toBe(4);
  });
});
