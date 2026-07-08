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
}

export const blockSkins: Partial<Record<BlockType, SkinOption[]>> = {
  hero: [
    { id: "", label: "Класичний (по центру)" },
    { id: "split", label: "Текст ліворуч, акцент праворуч" },
    { id: "minimal", label: "Мінімальний" },
  ],
  services: [
    { id: "", label: "Картки" },
    { id: "list", label: "Список із цінами" },
    { id: "compact", label: "Компактна сітка" },
  ],
};

export function skinsFor(type: BlockType): SkinOption[] {
  return blockSkins[type] ?? [];
}

/** Random skin id for generation-time variety (different sites look different). */
export function randomSkin(type: BlockType): string | undefined {
  const options = blockSkins[type];
  if (!options || options.length === 0) return undefined;
  const pick = options[Math.floor(Math.random() * options.length)];
  return pick.id || undefined; // default stays as absent
}
