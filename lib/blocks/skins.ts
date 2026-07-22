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
    // Legacy band skins removed (owner order, DNA-2c): only the wave-2
    // archetypes remain — structurally distinct, honest no-photo states
    // (components/blocks/Hero.tsx; sources in THIRD_PARTY_NOTICES). "" maps
    // to the dispatcher fallback (editorial / split-light by photo presence).
    { id: "photo-scrim", label: "Фото на весь екран, текст знизу" },
    { id: "editorial", label: "Типографічний (без фото)" },
    { id: "split-light", label: "Світлий спліт: текст + фото" },
    { id: "card-overlay", label: "Картка поверх фото" },
    { id: "visit-card", label: "Світла візитівка" },
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

/** Random skin id for generation-time variety (different sites look different).
 *  `rng` injection (design-DNA wave 1): seeded callers pass their PRNG so the
 *  draw is reproducible per tenantId+nonce; default stays Math.random. */
export function randomSkin(type: BlockType, rng: () => number = Math.random): string | undefined {
  const options = (blockSkins[type] ?? []).filter((o) => o.lottery !== false);
  if (options.length === 0) return undefined;
  const pick = options[Math.floor(rng() * options.length)];
  return pick.id || undefined; // default stays as absent
}
