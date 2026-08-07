import { describe, expect, it } from "vitest";
import {
  applyCharBudgets,
  applyPlanVariantDefaults,
  enforceSectionPlan,
  shippedSectionPlan,
} from "./generate";
import { getTemplate } from "@/lib/templates/registry";
import type { BlockType, StoredBlock } from "@/lib/blocks/schema";
import type { SectionPlanEntry } from "@/lib/site/design-spec";

/**
 * sectionPlan enforcement + budget clamps (pipeline v2 §3). The contract under
 * test: the S1 plan gates MODEL blocks only — force-injected/structural types
 * (hero, contacts, lead_form, gallery) pass regardless (invariant 8); the
 * plan's variants are DEFAULTS, never overrides; budget hints clamp
 * deterministically and never drop a block.
 */

const template = getTemplate("salonwire")!;

type Slim = { type: BlockType; section?: string };

describe("enforceSectionPlan", () => {
  const plan: SectionPlanEntry[] = [
    { section: "hero" },
    { section: "services" },
    { section: "faq" },
  ];

  it("drops model blocks whose section is outside the plan", () => {
    const blocks: Slim[] = [
      { type: "hero", section: "hero" },
      { type: "services", section: "services" },
      { type: "stats", section: "stats" },
      { type: "cta", section: "cta" },
      { type: "faq", section: "faq" },
    ];
    expect(enforceSectionPlan(blocks, plan, template).map((b) => b.type)).toEqual([
      "hero",
      "services",
      "faq",
    ]);
  });

  it("exempts the force-injected/structural types even when unplanned", () => {
    const blocks: Slim[] = [
      { type: "hero" },
      { type: "gallery", section: "gallery" }, // not in plan — injection-exempt
      { type: "lead_form" },
      { type: "contacts" },
    ];
    expect(enforceSectionPlan(blocks, plan, template)).toEqual(blocks);
  });

  it("resolves a wrong section label to the type's home before judging", () => {
    // The model mislabels services as «pricing» — resolvedSection maps the
    // type to its real home, which IS planned, so the block survives.
    const blocks: Slim[] = [{ type: "services", section: "pricing" }];
    expect(enforceSectionPlan(blocks, plan, template)).toHaveLength(1);
  });

  it("is the identity without a plan or a template (v1 path)", () => {
    const blocks: Slim[] = [{ type: "stats", section: "stats" }];
    expect(enforceSectionPlan(blocks, undefined, template)).toEqual(blocks);
    expect(enforceSectionPlan(blocks, [], template)).toEqual(blocks);
    expect(enforceSectionPlan(blocks, plan, undefined)).toEqual(blocks);
  });

  it("keeps the model's composition when the plan would strip every content section", () => {
    // A schema-valid plan of exempt-only sections ([hero, gallery]) must not
    // ship a page of bookends: the floor skips enforcement for that run.
    const bookendPlan: SectionPlanEntry[] = [{ section: "hero" }, { section: "gallery" }];
    const blocks: Slim[] = [
      { type: "hero", section: "hero" },
      { type: "services", section: "services" },
      { type: "faq", section: "faq" },
    ];
    expect(enforceSectionPlan(blocks, bookendPlan, template)).toEqual(blocks);
  });
});

const stored = (b: Record<string, unknown> & { type: BlockType }): StoredBlock =>
  ({ showInNav: false, hidden: false, ...b }) as unknown as StoredBlock;

describe("applyPlanVariantDefaults", () => {
  it("fills a missing variant from the plan, but never overrides the model", () => {
    const blocks = [
      stored({ type: "hero", section: "hero", props: { title: "Т" } }),
      stored({ type: "hero", section: "hero", variant: "banner", props: { title: "Т" } }),
    ];
    const plan: SectionPlanEntry[] = [{ section: "hero", variant: "mirror" }];
    const out = applyPlanVariantDefaults(blocks, plan, template);
    expect(out[0].variant).toBe("mirror");
    expect(out[1].variant).toBe("banner");
  });

  it("ignores plan variants the section does not register", () => {
    const blocks = [stored({ type: "gallery", section: "gallery", props: { images: [] } })];
    const plan: SectionPlanEntry[] = [{ section: "gallery", variant: "masonry" }];
    expect(applyPlanVariantDefaults(blocks, plan, template)[0].variant).toBeUndefined();
  });

  it("is the identity without a plan", () => {
    const blocks = [stored({ type: "hero", section: "hero", props: { title: "Т" } })];
    expect(applyPlanVariantDefaults(blocks, undefined, template)).toEqual(blocks);
  });
});

describe("applyCharBudgets", () => {
  const longText = (n: number) => Array.from({ length: n }, (_, i) => `слово${i}`).join(" ");

  it("clamps primary text of a compact-hinted section, word-safe, with «…»", () => {
    const blocks = [
      stored({
        type: "hero",
        section: "hero",
        props: { title: longText(30), subtitle: longText(60) },
      }),
    ];
    const plan: SectionPlanEntry[] = [{ section: "hero", budgetHint: "стисло" }];
    const out = applyCharBudgets(blocks, plan);
    const hero = out[0] as Extract<StoredBlock, { type: "hero" }>;
    expect(hero.props.title.length).toBeLessThanOrEqual(71); // cap + «…»
    expect(hero.props.title.endsWith("…")).toBe(true);
    expect(hero.props.title).not.toMatch(/\s…$/u);
    expect(hero.props.subtitle!.length).toBeLessThanOrEqual(161);
  });

  it("leaves non-compact hints, unhinted sections and short text alone", () => {
    const blocks = [
      stored({
        type: "faq",
        section: "faq",
        props: { items: [{ question: "Як?", answer: longText(80) }] },
      }),
      stored({
        type: "services",
        section: "services",
        props: { items: [{ name: "Стрижка", description: longText(50) }] },
      }),
      stored({ type: "hero", section: "hero", props: { title: "Коротко" } }),
    ];
    const plan: SectionPlanEntry[] = [
      { section: "faq", budgetHint: "розгорнуто" },
      { section: "services" },
      { section: "hero", budgetHint: "стисло" },
    ];
    const out = applyCharBudgets(blocks, plan);
    expect(out[0]).toEqual(blocks[0]);
    expect(out[1]).toEqual(blocks[1]);
    expect((out[2] as Extract<StoredBlock, { type: "hero" }>).props.title).toBe("Коротко");
  });

  it("never touches testimonial quotes — a customer's words are a fact", () => {
    const quote = longText(80);
    const blocks = [
      stored({
        type: "testimonials",
        section: "testimonials",
        props: { items: [{ quote, author: "Олена" }] },
      }),
    ];
    const plan: SectionPlanEntry[] = [{ section: "testimonials", budgetHint: "стисло" }];
    const out = applyCharBudgets(blocks, plan);
    expect((out[0] as Extract<StoredBlock, { type: "testimonials" }>).props.items[0].quote).toBe(
      quote,
    );
  });

  it("is deterministic (idempotent on its own output)", () => {
    const blocks = [
      stored({ type: "hero", section: "hero", props: { title: longText(30) } }),
    ];
    const plan: SectionPlanEntry[] = [{ section: "hero", budgetHint: "коротко" }];
    const once = applyCharBudgets(blocks, plan);
    expect(applyCharBudgets(once, plan)).toEqual(once);
  });

  it("never truncates fact-bearing copy — confirmed requisites survive the clamp", () => {
    // The answer carries the confirmed hours; a clamp would ship a half-true
    // requisite («…сб 10:00–…») — worse than length overshoot (invariant 5).
    const answer = `Працюємо пн–пт 9:00–18:00, сб 10:00–16:00. ${longText(60)}`;
    const blocks = [
      stored({
        type: "faq",
        section: "faq",
        props: { items: [{ question: "Графік?", answer }] },
      }),
    ];
    const plan: SectionPlanEntry[] = [{ section: "faq", budgetHint: "стисло" }];
    const facts = { businessName: "Тест", hours: "пн–пт 9:00–18:00, сб 10:00–16:00" };
    const out = applyCharBudgets(blocks, plan, facts);
    expect((out[0] as Extract<StoredBlock, { type: "faq" }>).props.items[0].answer).toBe(answer);
    // Without the facts corpus the same string still clamps (test-path parity).
    const bare = applyCharBudgets(blocks, plan);
    expect(
      (bare[0] as Extract<StoredBlock, { type: "faq" }>).props.items[0].answer.endsWith("…"),
    ).toBe(true);
  });
});

describe("shippedSectionPlan", () => {
  it("returns visible placed sections with variants, in page order", () => {
    const blocks = [
      stored({ type: "hero", section: "hero", variant: "mirror", props: { title: "Т" } }),
      stored({ type: "services", section: "services", props: { items: [] } }),
      stored({ type: "stats", section: "stats", hidden: true, props: { items: [] } }),
      stored({ type: "marquee", props: { items: [] } }), // section-less → skipped
      stored({ type: "lead_form", section: "lead_form", props: {} }),
      stored({ type: "contacts", section: "contacts", props: {} }),
    ];
    expect(shippedSectionPlan(blocks)).toEqual([
      { section: "hero", variant: "mirror" },
      { section: "services" },
      { section: "lead_form" },
      { section: "contacts" },
    ]);
  });
});
