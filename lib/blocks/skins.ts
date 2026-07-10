import type { BlockType } from "./schema";

/**
 * Block skins — presentation variants of the SAME content (build-plan п.3).
 * A skin changes layout only; content/props are untouched, so switching is
 * instant and safe. Template-mining converts liked external templates into new
 * entries here (the registry grows, never forks).
 */
export interface SkinOption {
  id: string; // "" = default variant baked into the component
  label: string; // Ukrainian, shown in the editor picker
  // false = editor-only: excluded from the generation lottery. Used for skins
  // that hide load-bearing content (e.g. services skins without prices) — an
  // owner may choose them deliberately, the lottery must not.
  lottery?: boolean;
}

export const blockSkins: Partial<Record<BlockType, SkinOption[]>> = {
  hero: [
    { id: "", label: "Класичний (по центру)" },
    { id: "split", label: "Текст ліворуч, акцент праворуч" },
    { id: "minimal", label: "Мінімальний" },
    { id: "photo", label: "Фото на весь екран" },
    { id: "gradient", label: "Градієнт" },
    { id: "mesh", label: "М'які кольорові плями" },
  ],
  services: [
    { id: "", label: "Картки" },
    { id: "list", label: "Список із цінами" },
    { id: "compact", label: "Компактна сітка" },
    { id: "showcase", label: "Вітрина з фото" },
    { id: "pricing", label: "Тарифні картки" },
    // Price-hiding layouts: owner's deliberate choice only (lottery: false).
    { id: "trust", label: "Іконки-переваги (без цін)", lottery: false },
    { id: "steps", label: "Кроки процесу (без цін)", lottery: false },
  ],
  switchback: [
    { id: "", label: "Класичний зигзаг" },
    { id: "framed", label: "Обрамлені панелі" },
  ],
  testimonials: [
    { id: "", label: "Сітка відгуків" },
    { id: "spotlight", label: "Головна цитата" },
  ],
  faq: [
    { id: "", label: "Список" },
    { id: "accordion", label: "Акордеон" },
  ],
  gallery: [
    { id: "", label: "Сітка" },
    { id: "captions", label: "Підписи при наведенні" },
  ],
};

export function skinsFor(type: BlockType): SkinOption[] {
  return blockSkins[type] ?? [];
}

/** Random skin id for generation-time variety (different sites look different). */
export function randomSkin(type: BlockType): string | undefined {
  const options = (blockSkins[type] ?? []).filter((o) => o.lottery !== false);
  if (options.length === 0) return undefined;
  const pick = options[Math.floor(Math.random() * options.length)];
  return pick.id || undefined; // default stays as absent
}
