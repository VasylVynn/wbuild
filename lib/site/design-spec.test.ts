import { describe, expect, it } from "vitest";
import { wcagContrast } from "culori";
import {
  buildFactsCorpus,
  designSpecSchema,
  findUngroundedClaims,
  repairPaletteContrast,
  validateDesignSpec,
  type DesignSpec,
} from "./design-spec";
import { publishedFromDraft, type PageContent } from "./page-content";

const FACTS = {
  businessName: "Квіти від Олени",
  city: "Львів",
  phone: "+38 (067) 123-45-67",
  hours: "щодня 9:00–19:00",
  about: "Працюємо з 2015 року, понад 10 років досвіду",
  services: [{ name: "Букет нареченої", price: "від 1500 грн" }],
};

const ALLOWED = {
  hero: ["split", "mirror", "banner"],
  services: ["grid"],
  gallery: ["grid"],
} satisfies Record<string, readonly string[]>;

const CTX = { facts: FACTS, allowedVariants: ALLOWED, fallbackPairId: "cormorant-manrope" };

function validSpec(): DesignSpec {
  return {
    positioning: {
      promise: "Букети, які говорять за вас",
      painPoints: ["Немає часу шукати флориста", "Квіти в'януть за день"],
      tone: "тепло і впевнено",
      voiceNotes: "звертання на «ви», без канцеляриту",
    },
    palette: {
      bg: "#faf7f2",
      surface: "#ffffff",
      ink: "#2b2118",
      accent: "#7a1f3d",
      accentInk: "#ffffff",
    },
    typography: { pairId: "playfair-inter" },
    sectionPlan: [
      { section: "hero", variant: "split", budgetHint: "стисло" },
      { section: "services" },
      { section: "gallery", variant: "grid" },
    ],
    motion: { level: 2, notes: "м'які появи" },
    imagery: { treatment: "теплі повітряні кадри, легкий крем-фільтр", heroPhotoId: "ph_1" },
  };
}

describe("designSpecSchema round-trip", () => {
  it("parses a valid spec unchanged and validate returns it verbatim", () => {
    const spec = validSpec();
    expect(designSpecSchema.parse(spec)).toEqual(spec);
    const result = validateDesignSpec(spec, CTX);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.spec).toEqual(spec);
      expect(result.repairs).toEqual([]);
    }
  });

  it("rejects malformed payloads honestly (ok: false, caller falls back to v1)", () => {
    const result = validateDesignSpec({ positioning: {} }, CTX);
    expect(result.ok).toBe(false);
    expect(result.repairs.length).toBeGreaterThan(0);
  });

  it("rejects a bad hex and a motion level outside 0–3", () => {
    expect(designSpecSchema.safeParse({ ...validSpec(), palette: { ...validSpec().palette, bg: "#fff" } }).success).toBe(false);
    expect(designSpecSchema.safeParse({ ...validSpec(), motion: { level: 4 } }).success).toBe(false);
  });
});

describe("fact gate (findUngroundedClaims)", () => {
  const corpus = buildFactsCorpus(FACTS);

  it("passes numbers that ARE in confirmed facts («10 років», «з 2015 року», price)", () => {
    expect(findUngroundedClaims("Понад 10 років досвіду", corpus)).toEqual([]);
    expect(findUngroundedClaims("Працюємо з 2015 року", corpus)).toEqual([]);
    expect(findUngroundedClaims("Букети від 1500 грн", corpus)).toEqual([]);
  });

  it("flags invented numerals, dates and durations", () => {
    expect(findUngroundedClaims("Понад 25 років досвіду", corpus)).toEqual([
      { token: "25", reason: "numeral" },
    ]);
    expect(findUngroundedClaims("Засновано у 1998 році", corpus)).toEqual([
      { token: "1998", reason: "numeral" },
    ]);
  });

  it("flags «цілодобово» unless facts mention it", () => {
    expect(findUngroundedClaims("Працюємо цілодобово", corpus)).toEqual([
      { token: "цілодобово", reason: "duration" },
    ]);
    const nightCorpus = buildFactsCorpus({ hours: "цілодобово" });
    expect(findUngroundedClaims("Працюємо цілодобово", nightCorpus)).toEqual([]);
  });

  it("matches phone-shaped tokens format-free against facts.phone", () => {
    // Same digits, different formatting than the stored «+38 (067) 123-45-67».
    expect(findUngroundedClaims("Телефонуйте: 067 123-45-67", corpus)).toEqual([]);
    // A different, invented phone is contact-flagged.
    const hits = findUngroundedClaims("Телефонуйте: 099 888-77-66", corpus);
    expect(hits).toHaveLength(1);
    expect(hits[0].reason).toBe("contact");
  });

  it("flags invented handles and passes plain copy", () => {
    expect(findUngroundedClaims("Пишіть нам у @kvity_lviv", corpus)).toEqual([
      { token: "@kvity_lviv", reason: "contact" },
    ]);
    expect(findUngroundedClaims("Квіти, які говорять за вас", corpus)).toEqual([]);
  });
});

describe("validateDesignSpec repairs", () => {
  it("strips ungrounded positioning strings whole", () => {
    const spec = validSpec();
    spec.positioning.promise = "15 000 щасливих клієнтів";
    spec.positioning.painPoints = ["Немає часу", "Чекати 3 тижні на доставку"];
    spec.positioning.voiceNotes = "згадуй @kvity_lviv усюди";
    const result = validateDesignSpec(spec, CTX);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.spec.positioning.promise).toBe("");
    expect(result.spec.positioning.painPoints).toEqual(["Немає часу"]);
    expect(result.spec.positioning.voiceNotes).toBeUndefined();
    expect(result.repairs.filter((r) => r.startsWith("fact-gate:"))).toHaveLength(3);
  });

  it("repairs an out-of-whitelist pairId to the seeded proposal", () => {
    const spec = validSpec();
    spec.typography.pairId = "comic-sans-arial";
    const result = validateDesignSpec(spec, CTX);
    expect(result.ok && result.spec.typography.pairId).toBe("cormorant-manrope");
  });

  it("drops unknown sections, degrades unregistered variants, fails on empty plan", () => {
    const spec = validSpec();
    spec.sectionPlan = [
      { section: "hero", variant: "hologram" },
      { section: "pricing_matrix" },
    ];
    const result = validateDesignSpec(spec, CTX);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.spec.sectionPlan).toEqual([{ section: "hero" }]);

    const empty = validSpec();
    empty.sectionPlan = [{ section: "pricing_matrix" }];
    expect(validateDesignSpec(empty, CTX).ok).toBe(false);
  });
});

describe("palette repair", () => {
  it("is deterministic and reaches 4.5:1 on both role pairs", () => {
    const bad = {
      bg: "#F5F5F0",
      surface: "#ffffff",
      ink: "#B8B2A6", // ~1.9:1 on bg
      accent: "#7A1F3D",
      accentInk: "#8A2F4D", // near-accent — unreadable
    };
    const a = repairPaletteContrast(bad);
    const b = repairPaletteContrast(bad);
    expect(a).toEqual(b); // deterministic
    expect(a.repairs.length).toBe(2);
    expect(wcagContrast(a.palette.ink, a.palette.bg)).toBeGreaterThanOrEqual(4.5);
    expect(wcagContrast(a.palette.accentInk, a.palette.accent)).toBeGreaterThanOrEqual(4.5);
    // Anchors themselves never move — only ink roles.
    expect(a.palette.bg).toBe("#f5f5f0");
    expect(a.palette.accent).toBe("#7a1f3d");
  });

  it("leaves a passing palette untouched (lowercased only)", () => {
    const good = validSpec().palette;
    const { palette, repairs } = repairPaletteContrast(good);
    expect(repairs).toEqual([]);
    expect(palette).toEqual(good);
  });
});

describe("DRAFT_ONLY strip (publishedFromDraft)", () => {
  it("strips designRationale + contentRev, keeps designSpec", () => {
    const draft: PageContent = {
      blocks: [],
      designSpec: validSpec(),
      designRationale: "бо власниця просила тепло",
      contentRev: 7,
      pocket: [],
    };
    const published = publishedFromDraft(draft);
    expect(published.designSpec).toEqual(validSpec());
    expect("designRationale" in published).toBe(false);
    expect("contentRev" in published).toBe(false);
    expect("pocket" in published).toBe(false);
  });
});
