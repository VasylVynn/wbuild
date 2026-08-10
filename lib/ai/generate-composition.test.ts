import { describe, expect, it } from "vitest";
import { applySingleItemLayouts, cleanBenefitStrip, meetsItemFloor } from "./generate";
import { blockLibrary } from "@/lib/blocks/library";
import { getTemplate } from "@/lib/templates/registry";
import type { StoredBlock } from "@/lib/blocks/schema";

/**
 * Composition quality rules from the owner's live review of a generated site
 * (2026-08-10):
 *  - item 4: the benefits strip must never ship visible SEO keyword chips;
 *  - item 5: a card grid must never ship holding exactly one card.
 * Both are DATA rules enforced deterministically after generation — the prompt
 * asks, this code guarantees.
 */

const template = getTemplate("salonwire")!;

describe("cleanBenefitStrip", () => {
  it("drops the whole strip that shipped on the tennis site", () => {
    // Verbatim from the live failure: «Наш світ» over a row of keyword chips.
    const items = ["Теніс", "Tennis", "Тенісльвів", "Львів", "Львівтеніс", "Тренер з тенісу", "Tennis coach"];
    expect(cleanBenefitStrip(items, "Львів")).toEqual([]);
  });

  it("keeps a genuine benefits row untouched", () => {
    const items = [
      "Тренування під ваш рівень",
      "Зручний час занять",
      "Підтримка новачків",
      "Корти в центрі міста",
    ];
    expect(cleanBenefitStrip(items, "Львів")).toEqual(items);
  });

  it("drops hashtags, latin duplicates, city words and concatenations", () => {
    const kept = cleanBenefitStrip(
      [
        "#теніс",
        "Tennis",
        "Тенісльвів",
        "Тренування під ваш рівень",
        "Зручний час занять",
        "Підтримка на кожному занятті",
        "Ракетки надаємо на місці",
      ],
      "Львів",
    );
    expect(kept).toEqual([
      "Тренування під ваш рівень",
      "Зручний час занять",
      "Підтримка на кожному занятті",
      "Ракетки надаємо на місці",
    ]);
  });

  it("drops the strip when the keyword chips outnumber the real theses", () => {
    // Conceived as a keyword strip: a query-shaped leftover standing among two
    // benefits still reads as stuffing, so the section goes whole.
    expect(
      cleanBenefitStrip(
        ["Теніс", "Tennis", "Львів", "Тенісльвів", "Тренер з тенісу", "Зручний час занять"],
        "Львів",
      ),
    ).toEqual([]);
  });

  it("drops a row that is ONLY bare single words — a tag cloud whatever the words", () => {
    expect(cleanBenefitStrip(["Затишок", "Досвід", "Якість"])).toEqual([]);
  });

  it("keeps an honest row that merely happens to contain short nouns", () => {
    // Ukrainian benefits are frequently one word; the earlier «half or more are
    // bare» verdict deleted exactly the cheapest honest substance a data-poor
    // page has (review 2026-08-10).
    const items = ["Оренда корту", "Індивідуальні заняття", "Групи", "Абонементи"];
    expect(cleanBenefitStrip(items)).toEqual(items);
    expect(cleanBenefitStrip(["Затишок", "Досвід", "Якість", "Гнучкий графік"])).toEqual([
      "Затишок",
      "Досвід",
      "Якість",
      "Гнучкий графік",
    ]);
  });

  it("keeps the marquee floor and the schema on ONE number", () => {
    // A schema-legal 3-item strip must not be born already condemned.
    expect(blockLibrary.marquee.minItems).toBe(3);
    expect(meetsItemFloor("marquee", 3)).toBe(true);
  });

  it("deduplicates and ignores punctuation/case noise", () => {
    const kept = cleanBenefitStrip([
      "Тренування під ваш рівень",
      "тренування під ваш рівень!",
      "Зручний час занять",
      "Підтримка новачків",
      "Ракетки надаємо на місці",
    ]);
    expect(kept).toHaveLength(4);
  });

  it("never invents items to reach the floor", () => {
    expect(cleanBenefitStrip(["Тренування під ваш рівень", "Зручний час занять"])).toEqual([
      "Тренування під ваш рівень",
      "Зручний час занять",
    ]);
    // …and two survivors are below the marquee floor, so the section is dropped
    // by meetsItemFloor rather than padded.
    expect(meetsItemFloor("marquee", 2)).toBe(false);
  });
});

describe("meetsItemFloor", () => {
  it("drops the sections whose grid of one reads as a bug", () => {
    expect(meetsItemFloor("stats", 1)).toBe(false);
    expect(meetsItemFloor("publications", 1)).toBe(false);
    expect(meetsItemFloor("timeline", 2)).toBe(false);
    expect(meetsItemFloor("faq", 1)).toBe(false);
    expect(meetsItemFloor("marquee", 2)).toBe(false);
  });

  it("passes them once the floor is met", () => {
    expect(meetsItemFloor("stats", 2)).toBe(true);
    expect(meetsItemFloor("publications", 2)).toBe(true);
    expect(meetsItemFloor("timeline", 3)).toBe(true);
    expect(meetsItemFloor("faq", 2)).toBe(true);
    expect(meetsItemFloor("marquee", 4)).toBe(true);
  });

  it("never drops the sections whose thin content is genuine (layout adapts)", () => {
    // One real coach, one real review, one real service: the DATA survives —
    // the wireframe's single-item guard and applySingleItemLayouts handle the look.
    expect(meetsItemFloor("team", 1)).toBe(true);
    expect(meetsItemFloor("testimonials", 1)).toBe(true);
    expect(meetsItemFloor("services", 1)).toBe(true);
  });

  it("ignores blocks that have no item list at all", () => {
    expect(meetsItemFloor("hero", undefined)).toBe(true);
    expect(meetsItemFloor("cta", undefined)).toBe(true);
  });

  it("keeps the library table and the enforcement in sync", () => {
    for (const [type, entry] of Object.entries(blockLibrary)) {
      if (entry.belowMin === undefined) continue;
      expect(entry.minItems, `${type} declares belowMin without minItems`).toBeGreaterThan(1);
    }
  });
});

describe("applySingleItemLayouts", () => {
  const testimonial = (n: number, variant?: string): StoredBlock => ({
    type: "testimonials",
    props: {
      title: "Відгуки",
      items: Array.from({ length: n }, (_, i) => ({ quote: `Цитата ${i}`, author: `Автор ${i}` })),
    },
    section: "testimonials",
    variant,
    showInNav: true,
    hidden: false,
  });

  it("gives a lone review the big-quote layout instead of a one-card grid", () => {
    expect(applySingleItemLayouts([testimonial(1, "cards")], template)[0].variant).toBe("big-quote");
  });

  it("leaves multi-item sections alone", () => {
    expect(applySingleItemLayouts([testimonial(3, "cards")], template)[0].variant).toBe("cards");
  });

  it("gives a lone service the row layout, but keeps a photo cast", () => {
    const svc = (imageUrl?: string): StoredBlock => ({
      type: "services",
      props: { title: "Послуги", items: [{ name: "Оренда корту", ...(imageUrl && { imageUrl }) }] },
      section: "services",
      variant: "grid",
      showInNav: true,
      hidden: false,
    });
    expect(applySingleItemLayouts([svc()], template)[0].variant).toBe("list-rows");
    expect(applySingleItemLayouts([svc("https://x.supabase.co/photos/a.jpg")], template)[0].variant).toBe(
      "grid",
    );
  });

  it("leaves a single team card to the wireframe's render guard (no data change)", () => {
    const team: StoredBlock = {
      type: "team",
      props: { title: "Наша тренерка", items: [{ name: "Анна", role: "Тренерка" }] },
      section: "team",
      showInNav: true,
      hidden: false,
    };
    expect(applySingleItemLayouts([team], template)).toEqual([team]);
  });
});
