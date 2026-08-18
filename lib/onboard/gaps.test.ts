import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import {
  asksClarifyingQuestion,
  detectGaps,
  questionBudgetCeiling,
  selectGaps,
  countAgentQuestions,
  MAX_GAPS,
  MAX_CLARIFYING_QUESTIONS,
  type GapInput,
} from "@/lib/onboard/gaps";
import { verticals, VERTICAL_IDS } from "@/lib/verticals/registry";
import type { Dossier } from "@/lib/dossier";

/**
 * Gap detection (owner feedback 2026-08-10 §6). The contract under test:
 * the RULE is data-shaped and vertical-agnostic, at most two gaps ever reach
 * the model, and the mechanism goes quiet the moment the owner has been asked
 * enough / wants to move on.
 */

const dossierWith = (bio: string, captions: string[] = []): Dossier => ({
  facts: null,
  brandVoice: { toneHints: [] },
  ig: {
    bioRaw: bio,
    businessContactCandidates: { phones: [], emails: [], addresses: [] },
    links: [],
    posts: captions.map((c, i) => ({ id: `p${i}`, captionExcerpt: c })),
  },
  mediaInventory: [],
});

const photos = (n: number) => ({ photos: Array.from({ length: n }, (_, i) => `https://s/p${i}.jpg`) });

const subjects = (input: GapInput) => detectGaps(input).map((g) => g.subject);

// ---------------------------------------------------------------------------
// R1 — a collection the page renders as a SET holds exactly one member.
// ---------------------------------------------------------------------------

describe("R1: singleton collections", () => {
  it("flags exactly one service, not two or more", () => {
    const one = subjects({
      facts: { businessName: "Ательє", city: "Львів", services: [{ name: "Індивідуальне заняття" }] },
      media: photos(4),
    });
    expect(one).toContain("services");

    const many = subjects({
      facts: {
        businessName: "Ательє",
        city: "Львів",
        services: [{ name: "А", price: "300 грн" }, { name: "Б", price: "500 грн" }],
      },
      media: photos(4),
    });
    expect(many).not.toContain("services");
  });

  it("never infers a person from free text (no gazetteer guessing)", () => {
    // Every one of these fired the old given-name + stem-prefix rule.
    for (const bio of [
      "Ромашки для вашого настрою — букет дня",
      "Вірю, що кожен клієнт заслуговує уваги",
      "Марка авто не має значення",
      "Любов до справи",
      "Школа для дорослих і дітей. Тренерка Анна.",
    ]) {
      expect(
        subjects({ facts: { businessName: "Бізнес", city: "Львів" }, media: photos(6), dossier: dossierWith(bio) }),
      ).not.toContain("people");
    }
  });

  it("flags a one-tile gallery and an empty one", () => {
    const base = { facts: { businessName: "Майстерня", city: "Львів" } };
    expect(subjects({ ...base, media: photos(1) })).toContain("photos");
    expect(subjects({ ...base, media: photos(0) })).toContain("photos");
    expect(subjects({ ...base, media: photos(5) })).not.toContain("photos");
  });

  it("flags a single testimonial", () => {
    const s = subjects({
      facts: {
        businessName: "Майстерня",
        city: "Львів",
        testimonials: [{ quote: "Дуже задоволена", author: "Оксана" }],
      },
      media: photos(5),
    });
    expect(s).toContain("testimonials");
  });
});

// ---------------------------------------------------------------------------
// R3/R4 — a decision-critical fact is absent, and the NEED is proven by other
// data we hold (not by the niche).
// ---------------------------------------------------------------------------

describe("R3/R4: missing decision-critical facts", () => {
  it("asks for hours when there is a place people come to", () => {
    const withAddress = subjects({
      facts: { businessName: "Майстерня", city: "Львів", address: "вул. Грабовського 11" },
      media: photos(5),
    });
    expect(withAddress).toContain("hours");

    const withHours = subjects({
      facts: {
        businessName: "Майстерня",
        city: "Львів",
        address: "вул. Грабовського 11",
        hours: "Пн–Пт 9:00–18:00",
      },
      media: photos(5),
    });
    expect(withHours).not.toContain("hours");
  });

  it("treats a photo of the premises as the same place signal", () => {
    const s = subjects({
      facts: { businessName: "Майстерня", city: "Львів" },
      media: {
        photos: ["https://s/a.jpg", "https://s/b.jpg"],
        photoMeta: [
          { url: "https://s/a.jpg", kind: "interior" },
          { url: "https://s/b.jpg", kind: "work" },
        ],
      },
    });
    expect(s).toContain("hours");
  });

  it("asks where the business works when there is no geography at all", () => {
    expect(subjects({ facts: { businessName: "Майстерня" }, media: photos(5) })).toContain("geo");
    expect(subjects({ facts: { businessName: "Майстерня", city: "Львів" }, media: photos(5) })).not.toContain(
      "geo",
    );
  });

  it("flags a price-silent site once services exist", () => {
    const silent = subjects({
      facts: {
        businessName: "Майстерня",
        city: "Львів",
        services: [{ name: "А" }, { name: "Б" }, { name: "В" }],
      },
      media: photos(5),
    });
    expect(silent).toContain("prices");

    const priced = subjects({
      facts: {
        businessName: "Майстерня",
        city: "Львів",
        services: [{ name: "А", price: "300 грн" }, { name: "Б" }, { name: "В" }],
      },
      media: photos(5),
    });
    expect(priced).not.toContain("prices");
  });

  it("flags a source hint the facts do not capture (hours in the bio)", () => {
    const s = subjects({
      facts: { businessName: "Майстерня", city: "Львів" },
      media: photos(5),
      dossier: dossierWith("Працюємо 09:00 - 20:00, без вихідних"),
    });
    expect(s).toContain("hours");
  });
});

// ---------------------------------------------------------------------------
// The cap — at most two gaps ever reach the model, strongest first.
// ---------------------------------------------------------------------------

describe("cap", () => {
  it("never returns more than MAX_GAPS, strongest first", () => {
    const many = detectGaps({
      facts: {
        businessName: "SAN Team",
        services: [{ name: "Одна послуга" }],
        testimonials: [{ quote: "Клас", author: "Оксана" }],
      },
      media: photos(1),
      dossier: dossierWith("Тренерка Анна. вул. Грабовського 11, з 9:00 - 21:00"),
    });
    expect(MAX_GAPS).toBe(2);
    expect(many).toHaveLength(2);
    expect(many[0].weight).toBeGreaterThanOrEqual(many[1].weight);
    // one gap per subject — never two questions about the same hole
    expect(new Set(many.map((g) => g.subject)).size).toBe(2);
  });

  it("stays silent before the business itself is known (generate-first)", () => {
    expect(detectGaps({ facts: {}, media: photos(0) })).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Turn budget + skip — the mechanism must never become an interrogation.
// ---------------------------------------------------------------------------

describe("selectGaps budget", () => {
  const input: GapInput = {
    facts: { businessName: "Майстерня", services: [{ name: "Одна послуга" }] },
    media: photos(0),
  };

  it("counts clarifying questions but not the generate proposal", () => {
    expect(
      countAgentQuestions([
        { role: "assistant", content: "Ось що вже є: **Назва:** Майстерня\n\nСтворюємо сайт?" },
        { role: "user", content: "ще ні" },
      ]),
    ).toBe(0);
    expect(
      countAgentQuestions([
        { role: "assistant", content: "Чи є ще фото?" },
        { role: "user", content: "ні" },
        { role: "assistant", content: "А де ви працюєте?" },
      ]),
    ).toBe(2);
  });

  it("goes quiet once the conversation budget is spent (rich dossier → ceiling 2)", () => {
    const spent = [
      { role: "user", content: "Майстерня" },
      { role: "assistant", content: "Чи є ще фото?" },
      { role: "user", content: "ні" },
      { role: "assistant", content: "А де ви працюєте?" },
      { role: "user", content: "Львів" },
    ];
    expect(MAX_CLARIFYING_QUESTIONS).toBe(2);
    // Instagram present → rich dossier → the strict 2-question ceiling.
    const rich = { ...input, facts: { ...input.facts, instagram: "maysternya" } };
    expect(selectGaps({ ...rich, transcript: spent })).toEqual([]);
    // one question asked → exactly one gap may still be raised
    expect(selectGaps({ ...rich, transcript: spent.slice(0, 3) })).toHaveLength(1);
  });

  it("thin dossier (no Instagram, no photos) gets the wider interview ceiling", () => {
    const spent = [
      { role: "user", content: "Майстерня" },
      { role: "assistant", content: "Чи є ще фото?" },
      { role: "user", content: "ні" },
      { role: "assistant", content: "А де ви працюєте?" },
      { role: "user", content: "Львів" },
    ];
    expect(questionBudgetCeiling({ facts: {}, media: undefined })).toBe(4);
    expect(
      questionBudgetCeiling({ facts: { instagram: "x" }, media: undefined }),
    ).toBe(2);
    // 2 spent of 4 → the detector may still raise gaps for a thin dossier
    expect(selectGaps({ ...input, transcript: spent }).length).toBeGreaterThan(0);
  });

  it("counts a gap-driven ask once per message, whatever the prose around it", () => {
    // A statement clause must not absolve the question clause beside it…
    expect(
      countAgentQuestions([
        { role: "assistant", content: "Створюю сайт із того, що вже маю. А фото ще є?" },
      ]),
    ).toBe(1);
    // …and two «?» in one turn is ONE interruption, not the whole budget.
    expect(
      countAgentQuestions([
        { role: "assistant", content: "А фото ще є? І де ви працюєте?" },
      ]),
    ).toBe(1);
  });

  it("does not spend the budget on the agent's ordinary conversational turns", () => {
    const opening = [
      { role: "assistant", content: "Бачу профіль. Як з вами звʼязатись — телефон чи Instagram?" },
      { role: "user", content: "телефон 0671112233" },
      { role: "assistant", content: "Записав. Це у Львові, правильно?" },
      { role: "user", content: "так, Львів" },
    ];
    expect(countAgentQuestions(opening)).toBe(0);
    expect(
      selectGaps({ facts: { businessName: "Майстерня", city: "Львів" }, media: photos(0), transcript: opening }),
    ).not.toEqual([]);
  });

  it("goes quiet when the owner says «just do it» or skips", () => {
    for (const said of ["просто зроби", "пропустити", "не знаю", "давай вже"]) {
      expect(selectGaps({ ...input, transcript: [{ role: "user", content: said }] })).toEqual([]);
    }
  });

  it("goes quiet the moment the owner agrees to generate", () => {
    // Including the app's own quick-reply chip — that turn must call
    // start_generation, not ask one more question.
    for (const said of ["Створюй сайт", "так, давай", "поїхали", "ок"]) {
      expect(selectGaps({ ...input, transcript: [{ role: "user", content: said }] })).toEqual([]);
    }
  });

  it("does not read «потім» inside a sentence as «stop asking»", () => {
    expect(
      selectGaps({
        ...input,
        transcript: [{ role: "user", content: "спочатку теніс для дорослих, потім ще щось додамо" }],
      }),
    ).not.toEqual([]);
  });

  it("goes quiet once the owner agreed to generate", () => {
    expect(selectGaps({ ...input, status: "confirmed" })).toEqual([]);
    expect(selectGaps({ ...input, status: "collecting" }).length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// The rule set is about the SHAPE of the data — never about a niche.
// ---------------------------------------------------------------------------

describe("vertical-agnostic", () => {
  const source = readFileSync(fileURLToPath(new URL("./gaps.ts", import.meta.url)), "utf8").toLowerCase();

  it("mentions no vertical id, label or alias anywhere in the module", () => {
    for (const id of VERTICAL_IDS) expect(source).not.toContain(id.toLowerCase());
    for (const v of Object.values(verticals)) {
      expect(source).not.toContain(v.label.toLowerCase());
      // short aliases like «сто» are substrings of ordinary words («місто»)
      for (const alias of v.aliases.filter((a) => a.length >= 4)) {
        expect(source).not.toContain(alias.toLowerCase());
      }
    }
  });

  it("produces the same gap shape for two unrelated businesses", () => {
    const shape = (bio: string) =>
      detectGaps({
        facts: { businessName: "Бізнес", city: "Львів", services: [{ name: "Послуга" }] },
        media: photos(1),
        dossier: dossierWith(bio),
      }).map((g) => `${g.rule}:${g.subject}`);
    expect(shape("Тенісна школа для дорослих")).toEqual(shape("Ремонт взуття на районі"));
  });

  it("notes carry no vertical label", () => {
    const notes = detectGaps({
      facts: { businessName: "Бізнес", services: [{ name: "Послуга" }] },
      media: photos(0),
    })
      .map((g) => g.note.toLowerCase())
      .join(" ");
    for (const v of Object.values(verticals)) expect(notes).not.toContain(v.label.toLowerCase());
  });
});

describe("asksClarifyingQuestion (same-round nudge guard)", () => {
  it("catches a menu question phrased without the budget cue words", () => {
    expect(asksClarifyingQuestion("Записав! Що у вас найчастіше замовляють гості?")).toBe(true);
    expect(asksClarifyingQuestion("Що у вас основне в меню?")).toBe(true);
  });
  it("ignores proposal and confirmation questions", () => {
    expect(asksClarifyingQuestion("Створюй сайт?")).toBe(false);
    expect(asksClarifyingQuestion("Все вірно?")).toBe(false);
    expect(asksClarifyingQuestion("Записав. Створюємо?")).toBe(false);
  });

  it("mixed questions with proposal words are STILL clarifying (codex regression)", () => {
    expect(asksClarifyingQuestion("Готові розповісти, що у вас в меню?")).toBe(true);
    expect(asksClarifyingQuestion("Створюємо сайт чи ще додасте послуги?")).toBe(true);
    expect(asksClarifyingQuestion("Генеруємо, чи спершу розкажете про заклад?")).toBe(true);
  });

  it("interrogative words beat substring-matched proposal verbs (codex regression 2)", () => {
    expect(asksClarifyingQuestion("Що готового буває зранку?")).toBe(true);
    expect(asksClarifyingQuestion("З чого починали свою справу?")).toBe(true);
    expect(asksClarifyingQuestion("Скільки готуєте на день?")).toBe(true);
    // pure proposals stay exempt — no interrogative, no cue
    expect(asksClarifyingQuestion("Готові починати?")).toBe(false);
  });

  it("pure proposals that merely MENTION a gap word do not suppress the nudge (codex regression 4)", () => {
    expect(asksClarifyingQuestion("Створюємо сайт із цими послугами?")).toBe(false);
    expect(asksClarifyingQuestion("Генеруємо з цими фото?")).toBe(false);
    // but the same words in a real question still count
    expect(asksClarifyingQuestion("Які послуги додати на сайт?")).toBe(true);
  });
  it("false on a plain statement", () => {
    expect(asksClarifyingQuestion("Записав: Затишок, контакт збережено.")).toBe(false);
  });
});

describe("services cue counts menu questions toward the budget", () => {
  it("counts «меню/страви» questions as gap questions", () => {
    expect(countAgentQuestions([{ role: "assistant", content: "Що у вас в меню?" }])).toBe(1);
    expect(countAgentQuestions([{ role: "assistant", content: "Які страви подаєте?" }])).toBe(1);
  });

  it("interview-axis questions spend budget even without a gap cue (codex regression 5)", () => {
    expect(countAgentQuestions([{ role: "assistant", content: "Чим ви особливі серед інших кафе?" }])).toBe(1);
    expect(countAgentQuestions([{ role: "assistant", content: "Хто ваші гості найчастіше?" }])).toBe(1);
    // readiness intake stays free…
    expect(countAgentQuestions([{ role: "assistant", content: "Як називається кафе і який телефон?" }])).toBe(0);
    // …but an intake word beside a gap cue still counts
    expect(countAgentQuestions([{ role: "assistant", content: "Яка назва і що у вас в меню?" }])).toBe(1);
    // tail confirmations are free
    expect(countAgentQuestions([{ role: "assistant", content: "Це у Львові, правильно?" }])).toBe(0);
  });

  it("mixed intake+substantive questions spend budget (codex regression 6)", () => {
    expect(
      countAgentQuestions([{ role: "assistant", content: "Як називається кафе і чим ви особливі?" }]),
    ).toBe(1);
    // pure intake across connectors stays free
    expect(
      countAgentQuestions([{ role: "assistant", content: "Залишите телефон або Instagram?" }]),
    ).toBe(0);
    expect(
      countAgentQuestions([{ role: "assistant", content: "Як називається кафе і який телефон?" }]),
    ).toBe(0);
  });

  it("channel mentions are not intake — activity questions spend budget (codex regression 7)", () => {
    expect(
      countAgentQuestions([{ role: "assistant", content: "Що публікуєте в Instagram?" }]),
    ).toBe(1);
    expect(
      countAgentQuestions([{ role: "assistant", content: "Як часто ведете Telegram?" }]),
    ).toBe(1);
    // real contact requests stay free
    expect(
      countAgentQuestions([{ role: "assistant", content: "Залишите Instagram чи телефон?" }]),
    ).toBe(0);
    expect(
      countAgentQuestions([{ role: "assistant", content: "Як з вами звʼязатись — телефон чи Instagram?" }]),
    ).toBe(0);
    // «Напишете телефон?» is a contact request — «пишете» inside «напишете»
    // must not trip the activity veto (codex regression 8)
    expect(countAgentQuestions([{ role: "assistant", content: "Напишете телефон?" }])).toBe(0);
    expect(countAgentQuestions([{ role: "assistant", content: "Що пишете в Instagram?" }])).toBe(1);
  });

  it("mixed proposal+gap questions spend budget too (codex regression 3)", () => {
    expect(
      countAgentQuestions([{ role: "assistant", content: "Готові розповісти, що у вас в меню?" }]),
    ).toBe(1);
    expect(
      countAgentQuestions([{ role: "assistant", content: "Створюємо сайт чи ще додасте послуги?" }]),
    ).toBe(1);
    // a PURE proposal that merely mentions services stays free
    expect(
      countAgentQuestions([{ role: "assistant", content: "Створюємо сайт із цими послугами?" }]),
    ).toBe(0);
  });
});
