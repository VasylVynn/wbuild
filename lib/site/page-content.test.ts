import { describe, it, expect } from "vitest";
import { publishedFromDraft, type PageContent } from "@/lib/site/page-content";

// 2026-08-13 incident: the deferred image job died (platform killed the
// after() callback) and the published copy kept `pendingImages` forever —
// permanent shimmer boxes on the LIVE gallery. The projection now strips
// them: live never renders «coming soon»; the draft keeps them for the job.
describe("publishedFromDraft", () => {
  const draft = (): PageContent =>
    ({
      genToken: "g1",
      contentRev: 7,
      pocket: [],
      blocks: [
        { type: "hero", props: { title: "Т" } },
        {
          type: "gallery",
          props: {
            title: "Атмосфера",
            images: [{ url: "https://x/storage/v1/object/public/photos/a.jpg" }],
            pendingImages: 4,
          },
        },
        { type: "contacts", props: {} },
      ],
    }) as unknown as PageContent;

  it("strips gallery pendingImages from the live copy", () => {
    const out = publishedFromDraft(draft());
    const gal = (out.blocks ?? []).find((b) => b.type === "gallery");
    expect(gal).toBeDefined();
    expect((gal!.props as { pendingImages?: number }).pendingImages).toBeUndefined();
    // the real content survives untouched
    expect((gal!.props as { title?: string }).title).toBe("Атмосфера");
    expect((gal!.props as { images?: unknown[] }).images).toHaveLength(1);
  });

  it("leaves non-gallery blocks and the draft itself alone", () => {
    const d = draft();
    const out = publishedFromDraft(d);
    expect(out.blocks?.[0]).toBe(d.blocks?.[0]); // untouched reference
    // draft-only top-level keys still stripped
    expect("pocket" in out).toBe(false);
    expect("contentRev" in out).toBe(false);
    // and the DRAFT object keeps its shimmer for the image job
    const draftGal = (d.blocks ?? []).find((b) => b.type === "gallery");
    expect((draftGal!.props as { pendingImages?: number }).pendingImages).toBe(4);
  });
});
