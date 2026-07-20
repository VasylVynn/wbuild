/**
 * Curated Cyrillic font PAIRS (design-DNA wave 1). PURE data — the actual
 * next/font loaders live in lib/theme/fonts.ts (imported only by layouts);
 * here we only reference their CSS variables, so this module is safe in any
 * client or server context (tokens.ts, editor, generation).
 *
 * Every stack references a `--font-*` variable that lib/theme/fonts.ts
 * registers on the tenant shell; when the class is absent the stack falls
 * back to the system font after the comma, never to an unstyled default.
 *
 * Selection rules (research doc): Google Fonts with a true `cyrillic` subset
 * (Ukrainian ґ/є/і/ї live in U+0490-0491 + U+0400-045F — covered); PT* and
 * Golos excluded deliberately (russian Paratype origin — wrong signal for a
 * Ukrainian product); Cormorant Garamond is verify-first (render-check ґєії
 * in the wave E2E before shipping a bundle on it).
 */

export type FontPair = {
  id: string;
  /** Ukrainian label for the editor UI («Шрифти: …»). */
  label: string;
  /** CSS stacks referencing variables registered by lib/theme/fonts.ts. */
  heading: string;
  body: string;
};

export const FONT_PAIRS: readonly FontPair[] = [
  {
    id: "manrope-inter",
    label: "Manrope + Inter — нейтральний модерн",
    heading: "var(--font-manrope), ui-sans-serif, system-ui, sans-serif",
    body: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
  },
  {
    id: "montserrat-rubik",
    label: "Montserrat + Rubik — енергійний",
    heading: "var(--font-montserrat), ui-sans-serif, system-ui, sans-serif",
    body: "var(--font-rubik), ui-sans-serif, system-ui, sans-serif",
  },
  {
    id: "lora-source",
    label: "Lora + Source Sans — теплий editorial",
    heading: "var(--font-lora), Georgia, serif",
    body: "var(--font-source-sans), ui-sans-serif, system-ui, sans-serif",
  },
  {
    id: "literata-inter",
    label: "Literata + Inter — класична довіра",
    heading: "var(--font-literata), Georgia, serif",
    body: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
  },
  {
    id: "cormorant-manrope",
    label: "Cormorant + Manrope — елегантний",
    heading: "var(--font-cormorant), Georgia, serif",
    body: "var(--font-manrope), ui-sans-serif, system-ui, sans-serif",
  },
  {
    id: "unbounded-inter",
    label: "Unbounded + Inter — сміливий",
    heading: "var(--font-unbounded), ui-sans-serif, system-ui, sans-serif",
    body: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
  },
  {
    id: "nunito-duo",
    label: "Nunito — мʼякий і привітний",
    heading: "var(--font-nunito), ui-rounded, 'Segoe UI', system-ui, sans-serif",
    body: "var(--font-nunito-sans), ui-sans-serif, system-ui, sans-serif",
  },
  {
    id: "playfair-jost",
    label: "Playfair + Jost — преміум",
    heading: "var(--font-playfair), Georgia, serif",
    body: "var(--font-jost), ui-sans-serif, system-ui, sans-serif",
  },
  {
    id: "onest",
    label: "Onest — сучасний нейтральний",
    heading: "var(--font-onest), ui-sans-serif, system-ui, sans-serif",
    body: "var(--font-onest), ui-sans-serif, system-ui, sans-serif",
  },
] as const;

export const FONT_PAIR_IDS = FONT_PAIRS.map((p) => p.id);

/** Unknown/absent id → undefined (legacy role-based FONT_STACK applies). */
export function resolveFontPair(id: string | undefined | null): FontPair | undefined {
  if (!id) return undefined;
  return FONT_PAIRS.find((p) => p.id === id);
}
