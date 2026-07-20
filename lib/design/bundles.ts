import type { BlockType } from "@/lib/blocks/schema";
import type { ThemePresetId } from "@/lib/theme/presets";
import type { MotionId } from "@/lib/theme/dna";

/**
 * Style bundles (design-DNA wave 2) — the evolution of design packs after the
 * research finding that all six packs shared one skin map («6 палітр на одному
 * layout»). A bundle is a hand-authored CLOSED tuple: palette family (2–3
 * presets of ONE family), a font pair, a hero ARCHETYPE with its own skin-set
 * for the rest of the page, and a mandatory photo-poor hero. Picking a bundle
 * changes the LAYOUT, not just the palette.
 *
 * ACCEPTANCE RULE (research risk #5): a new bundle ships only if its
 * heroArchetype + skin-set differ from every existing bundle. The four below
 * also carry four DISTINCT font pairs and four DISTINCT palette families, so
 * «different bundle» alone satisfies the 3-axis re-roll guarantee.
 *
 * HARD RULE inherited from packs: never assign price-hiding services skins
 * (trust/steps) — those stay manual-only editor choices.
 */
export interface StyleBundle {
  id: string;
  label: string; // Ukrainian, shown in the editor picker (DNA-2 UI)
  /** 2–3 presets of ONE palette family; the DNA picks one, seeded. */
  presetIds: ThemePresetId[];
  fontPairId: string;
  /** Hero skin when the tenant HAS photos. */
  heroArchetype: string;
  /** Hero skin when the photo pool is empty — deliberate, never a degraded band. */
  photoPoorHero: string;
  /** Skin per block type — deliberately DIFFERENT between bundles. */
  skins: Partial<Record<BlockType, string>>;
  /** Blessed per-type alternates the seeded composition axis may swap in. */
  skinAlternates?: Partial<Record<BlockType, string[]>>;
  /** Blessed motion presets for this bundle. */
  motionIds: MotionId[];
  /** Blessed decor treatments (DecorLayer ids, DNA-3); empty = none. */
  decorIds?: string[];
  verticalIds?: string[]; // affinity; undefined = fits any vertical
}

export const styleBundles: StyleBundle[] = [
  {
    id: "warm-editorial",
    label: "Тепла редакційна",
    presetIds: ["rose-classic", "peach-soft", "warm-bakery"],
    fontPairId: "lora-source",
    heroArchetype: "split-light",
    photoPoorHero: "editorial",
    skins: {
      services: "list",
      switchback: "",
      testimonials: "spotlight",
      faq: "accordion",
      gallery: "captions",
    },
    skinAlternates: { services: ["list", "showcase"], testimonials: ["spotlight", ""] },
    motionIds: ["fade-up", "stagger"],
    decorIds: ["mesh-soft", "noise"],
    verticalIds: ["florist", "bakery", "generic"],
  },
  {
    id: "light-visit",
    label: "Світла візитівка",
    presetIds: ["sage-minimal", "organic-emerald", "market-green"],
    fontPairId: "manrope-inter",
    heroArchetype: "visit-card",
    photoPoorHero: "visit-card",
    skins: {
      services: "",
      switchback: "framed",
      testimonials: "",
      faq: "",
      gallery: "",
    },
    skinAlternates: { services: ["", "compact"], faq: ["", "accordion"] },
    motionIds: ["none", "fade-up"],
    decorIds: ["frame", "dot-grid"],
  },
  {
    id: "photo-first",
    label: "Фото на повний екран",
    presetIds: ["studio-violet", "bold-slate"],
    fontPairId: "unbounded-inter",
    heroArchetype: "photo-scrim",
    photoPoorHero: "editorial",
    skins: {
      services: "showcase",
      switchback: "framed",
      testimonials: "spotlight",
      faq: "accordion",
      gallery: "captions",
    },
    skinAlternates: { services: ["showcase", "compact"] },
    motionIds: ["fade-up", "stagger"],
    decorIds: ["waves", "mesh-soft"],
    verticalIds: ["florist", "bakery", "generic"],
  },
  {
    id: "classic-trust",
    label: "Класична довіра",
    presetIds: ["navy-trust", "slate-professional", "clinic-blue"],
    fontPairId: "literata-inter",
    heroArchetype: "card-overlay",
    photoPoorHero: "visit-card",
    skins: {
      services: "pricing",
      switchback: "",
      testimonials: "",
      faq: "",
      gallery: "",
    },
    skinAlternates: { services: ["pricing", "list"] },
    motionIds: ["none", "fade-up"],
    decorIds: ["diagonal", "frame"],
    verticalIds: ["lawyer", "autoservice", "generic"],
  },
];

export function bundlesFor(verticalId?: string): StyleBundle[] {
  const matched = styleBundles.filter(
    (b) => !b.verticalIds || (verticalId != null && b.verticalIds.includes(verticalId)),
  );
  // A pool of ONE cannot honour the re-roll distinctness guarantee (codex
  // review: a new vertical matches only the unrestricted bundle) — below two
  // matches, distinctness beats affinity and the full catalog applies.
  return matched.length >= 2 ? matched : styleBundles;
}

export function getBundle(id: string | undefined | null): StyleBundle | undefined {
  if (!id) return undefined;
  return styleBundles.find((b) => b.id === id);
}
