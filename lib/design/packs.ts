import type { BlockType } from "@/lib/blocks/schema";
import type { ThemePresetId } from "@/lib/theme/presets";

/**
 * Design packs — the owner's answer to the "per-block skin lottery" (2026-07).
 *
 * A generated site must read as ONE cohesive design faithful to a real template
 * in template_sources/, not a random skin per block. A pack bundles a theme
 * preset with a FIXED skin per block type, mined from one source template. The
 * generation model still chooses WHICH sections it needs and writes all copy —
 * the pack dictates only the LOOK (palette, typography, per-block layout).
 *
 * HARD RULE: a pack NEVER assigns a price-hiding services skin (trust/steps).
 * Those hide load-bearing content and stay a deliberate manual-only choice in
 * the editor (see lib/blocks/skins.ts `lottery: false`).
 */
export interface DesignPack {
  id: string;
  label: string; // Ukrainian, shown in the editor picker
  description: string; // one Ukrainian line for the generation model
  source: string; // which template_sources design it's faithful to
  themePresetId: ThemePresetId;
  skins: Partial<Record<BlockType, string>>; // block type → skin id ("" = default)
  verticalIds?: string[]; // affinity; undefined = fits any vertical
}

export const designPacks: DesignPack[] = [
  {
    id: "bakery-craft",
    label: "Крафтова пекарня",
    description:
      "тепла крафтова пекарня: амбер на кремовому, класичні заголовки, фото-вітрина робіт",
    source: "artisan-bakery",
    themePresetId: "amber-craft",
    skins: {
      hero: "photo",
      services: "showcase",
      switchback: "framed",
      faq: "accordion",
      gallery: "captions",
    },
    verticalIds: ["bakery", "generic"],
  },
  {
    id: "organic-fresh",
    label: "Органік-фреш",
    description:
      "природний свіжий вигляд: смарагдовий, м'які округлі шрифти, повітряні картки",
    source: "organic-market",
    themePresetId: "organic-emerald",
    skins: {
      hero: "photo",
      services: "",
      gallery: "captions",
      faq: "accordion",
    },
    verticalIds: ["florist", "bakery", "generic"],
  },
  {
    id: "market-light",
    label: "Світлий маркет",
    description:
      "чистий світлий вигляд: свіжий зелений, текст ліворуч + акцент праворуч, обрамлені панелі",
    source: "whole-foods",
    themePresetId: "market-green",
    skins: {
      hero: "split",
      services: "",
      switchback: "framed",
    },
    verticalIds: ["florist", "bakery", "generic"],
  },
  {
    id: "construction-bold",
    label: "Потужний будівельний",
    description:
      "сильний діловий вигляд: графіт з амбер-акцентом, чіткий список послуг, фото-докази",
    source: "construction-pro",
    themePresetId: "construction-slate",
    skins: {
      hero: "photo",
      services: "list",
      gallery: "captions",
      testimonials: "",
    },
    verticalIds: ["autoservice", "generic"],
  },
  {
    id: "clinic-calm",
    label: "Спокійна клініка",
    description:
      "спокійний довірливий вигляд: м'який блакитний, тарифні картки, головна цитата-відгук",
    source: "dental-care",
    themePresetId: "clinic-blue",
    skins: {
      hero: "gradient",
      services: "pricing",
      testimonials: "spotlight",
      faq: "accordion",
    },
    verticalIds: ["lawyer", "generic"],
  },
  {
    id: "studio-premium",
    label: "Преміум-студія",
    description:
      "мінімалістичний преміум: майже білий з фіолетовим акцентом, тарифні картки, щільна сучасна подача",
    source: "design-template-main",
    themePresetId: "studio-violet",
    skins: {
      hero: "mesh",
      services: "pricing",
      faq: "accordion",
    },
    verticalIds: ["generic", "lawyer", "autoservice"],
  },
];

export const DESIGN_PACK_IDS: [string, ...string[]] = [
  designPacks[0].id,
  ...designPacks.slice(1).map((p) => p.id),
];

export function getPack(id: string | undefined): DesignPack | undefined {
  if (!id) return undefined;
  return designPacks.find((p) => p.id === id);
}

/**
 * Packs whose affinity matches a vertical. A pack with no `verticalIds` fits
 * any vertical. Falls back to ALL packs when nothing matches, so every vertical
 * always has options (every vertical is guaranteed ≥2 by the definitions above).
 */
export function packsFor(verticalId?: string): DesignPack[] {
  const matched = designPacks.filter(
    (p) => !p.verticalIds || (verticalId != null && p.verticalIds.includes(verticalId)),
  );
  return matched.length > 0 ? matched : designPacks;
}

/** A random pack compatible with the vertical — the fallback when the model doesn't pick a valid one. */
export function randomPack(verticalId?: string): DesignPack {
  const options = packsFor(verticalId);
  return options[Math.floor(Math.random() * options.length)];
}
