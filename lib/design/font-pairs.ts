/**
 * Curated font-pair whitelist — the typography axis of pipeline v2 (spec
 * 2026-08-07 §1/§4). The pool is EXACTLY the 14 cyrillic families the app
 * already loads: 12 tenant loaders in `lib/fonts.ts` (TENANT_FONT_CLASSES)
 * plus Manrope/Unbounded registered globally by the root layout
 * (`app/layout.tsx`). Nothing here may reference a family that is not loaded —
 * `font-pairs.test.ts` source-checks that invariant, because `lib/fonts.ts`
 * cannot be imported outside the Next compiler (next/font loaders are
 * build-time magic).
 *
 * V1 only rolls a seeded pair proposal (`lib/design/axes.ts`) and stores it in
 * the tuple guard; V2 feeds the whitelist + the proposal to the S1 design
 * brief (pairId ∈ whitelist, enforced in code) and injects
 * `--font-heading`/`--font-body` at render from designSpec — never as a
 * wireCss prefix.
 *
 * Weights follow the deleted-DNA guidance (docs/design-dna-plan.md, wave
 * DNA-2b): serif-lux carries beauty niches (florist, pet-grooming), robust
 * geometric sans carries autoservice, bookish serifs carry lawyer. `default`
 * covers verticals a pair does not name; 0 = never proposed for that vertical.
 */

export type FontFamilyId =
  | "inter"
  | "montserrat"
  | "rubik"
  | "lora"
  | "source-sans"
  | "literata"
  | "cormorant"
  | "nunito"
  | "nunito-sans"
  | "playfair"
  | "jost"
  | "onest"
  | "manrope"
  | "unbounded";

export interface FontFamily {
  /** CSS custom property the loader registers (next/font `variable`). */
  cssVar: string;
  /** The real family name, for prompts and font-family fallbacks. */
  label: string;
  /** Generic fallback keyword for the CSS font stack. */
  generic: "serif" | "sans-serif";
}

export const FONT_FAMILIES: Record<FontFamilyId, FontFamily> = {
  inter: { cssVar: "--font-inter", label: "Inter", generic: "sans-serif" },
  montserrat: { cssVar: "--font-montserrat", label: "Montserrat", generic: "sans-serif" },
  rubik: { cssVar: "--font-rubik", label: "Rubik", generic: "sans-serif" },
  lora: { cssVar: "--font-lora", label: "Lora", generic: "serif" },
  "source-sans": { cssVar: "--font-source-sans", label: "Source Sans 3", generic: "sans-serif" },
  literata: { cssVar: "--font-literata", label: "Literata", generic: "serif" },
  cormorant: { cssVar: "--font-cormorant", label: "Cormorant Garamond", generic: "serif" },
  nunito: { cssVar: "--font-nunito", label: "Nunito", generic: "sans-serif" },
  "nunito-sans": { cssVar: "--font-nunito-sans", label: "Nunito Sans", generic: "sans-serif" },
  playfair: { cssVar: "--font-playfair", label: "Playfair Display", generic: "serif" },
  jost: { cssVar: "--font-jost", label: "Jost", generic: "sans-serif" },
  onest: { cssVar: "--font-onest", label: "Onest", generic: "sans-serif" },
  manrope: { cssVar: "--font-manrope", label: "Manrope", generic: "sans-serif" },
  unbounded: { cssVar: "--font-unbounded", label: "Unbounded", generic: "sans-serif" },
};

export interface FontPair {
  id: string;
  heading: FontFamilyId;
  body: FontFamilyId;
  /** One line of character, Ukrainian — feeds the S1 brief prompt (V2). */
  vibe: string;
  /** Per-vertical draw weights; `default` covers unlisted verticals. */
  weights: { default: number } & Partial<Record<string, number>>;
}

export const FONT_PAIRS: FontPair[] = [
  {
    id: "playfair-inter",
    heading: "playfair",
    body: "inter",
    vibe: "класична розкіш, редакційна елегантність",
    weights: { default: 1, florist: 3, "pet-grooming": 2, bakery: 2, autoservice: 0 },
  },
  {
    id: "cormorant-manrope",
    heading: "cormorant",
    body: "manrope",
    vibe: "витончений преміум, легкість і повітря",
    weights: { default: 1, florist: 3, "pet-grooming": 2, autoservice: 0 },
  },
  {
    id: "lora-nunito-sans",
    heading: "lora",
    body: "nunito-sans",
    vibe: "тепла літературність, домашній затишок",
    weights: { default: 1, bakery: 3, florist: 2, "pet-grooming": 2, autoservice: 0 },
  },
  {
    id: "literata-source-sans",
    heading: "literata",
    body: "source-sans",
    vibe: "книжна ґрунтовність, довіра й досвід",
    weights: { default: 1, lawyer: 3, autoservice: 0 },
  },
  {
    id: "montserrat-inter",
    heading: "montserrat",
    body: "inter",
    vibe: "впевнена геометрія, діловий тон",
    weights: { default: 2, autoservice: 3, lawyer: 2, florist: 1, bakery: 1 },
  },
  {
    id: "rubik-nunito",
    heading: "rubik",
    body: "nunito",
    vibe: "дружня округлість, простота без пафосу",
    weights: { default: 2, "pet-grooming": 3, autoservice: 2, florist: 1, lawyer: 0 },
  },
  {
    id: "unbounded-manrope",
    heading: "unbounded",
    body: "manrope",
    vibe: "сміливий плакатний характер, енергія",
    weights: { default: 1, autoservice: 3, florist: 0, bakery: 0, "pet-grooming": 0, lawyer: 0 },
  },
  {
    id: "jost-source-sans",
    heading: "jost",
    body: "source-sans",
    vibe: "стриманий модернізм, чисті лінії",
    weights: { default: 2, lawyer: 2, autoservice: 2, bakery: 1 },
  },
  {
    id: "manrope-inter",
    heading: "manrope",
    body: "inter",
    vibe: "тихий сучасний нейтралітет",
    weights: { default: 2 },
  },
  {
    id: "onest-nunito-sans",
    heading: "onest",
    body: "nunito-sans",
    vibe: "сучасна дружність, український характер",
    weights: { default: 2, autoservice: 1, lawyer: 1 },
  },
];

/** The V2 render fallback when a draft carries no designSpec (spec §3-S1). */
export const DEFAULT_FONT_PAIR_ID = "manrope-inter";

export function getFontPair(id: string | undefined | null): FontPair | undefined {
  return FONT_PAIRS.find((p) => p.id === id);
}

/** A pair's draw weight for a vertical (unknown verticals → `default`). */
export function pairWeightFor(pair: FontPair, verticalId: string): number {
  return pair.weights[verticalId] ?? pair.weights.default;
}
