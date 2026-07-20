import type { Theme } from "./tokens";
import type { PaletteFamily } from "./dna";

/**
 * Curated theme presets across verticals. DNA-3 audit: every preset must
 * pass primaryForeground/primary >= 4.5:1 and fg/bg >= 7:1 — verified by
 * script (lib/theme/contrast.ts), never by eye; six legacy primaries were
 * darkened hue-true on 2026-07-21 to meet AA on CTAs. Generation picks ONE (by id) from the
 * subset a vertical allows — robust (no color hallucination), aligned with
 * switchTemplate (§4.7). Warm/floral for shops; professional/neutral for
 * services. `mood` is shown to the model so it chooses a fitting palette.
 */
export const THEME_PRESET_IDS = [
  "rose-classic",
  "sage-minimal",
  "burgundy-elegant",
  "peach-soft",
  "warm-bakery",
  "slate-professional",
  "navy-trust",
  "bold-slate",
  "emerald-fresh",
  // Design-pack presets (lib/design/packs.ts) — each faithful to one source in
  // template_sources/. Added, never swapped, so packs get a stable palette.
  "amber-craft",
  "organic-emerald",
  "market-green",
  "construction-slate",
  "clinic-blue",
  "studio-violet",
  // Wave DNA-3 expansion: curated палітри to widen re-roll variety and fill
  // under-served families (neutral/contrast). Added, never swapped.
  "honey-mustard",
  "cherry-blush",
  "deep-forest",
  "terracotta-clay",
  "graphite-ink",
  "ivory-linen",
  "stone-greige",
  "denim-craft",
  "lavender-provence",
  "plum-pop",
  "petrol-pop",
] as const;
export type ThemePresetId = (typeof THEME_PRESET_IDS)[number];

type PresetEntry = { label: string; mood: string; theme: Theme };

export const themePresets: Record<ThemePresetId, PresetEntry> = {
  "rose-classic": {
    label: "Класична троянда",
    mood: "тепла, романтична, класична",
    theme: {
      colors: { primary: "#b23a58", primaryForeground: "#fff8f6", background: "#fff8f6", foreground: "#3a2b2f", muted: "#e7d3d8", accent: "#f3e1e6" },
      fonts: { heading: "display", body: "sans" },
      radius: "lg",
    },
  },
  "sage-minimal": {
    label: "Шавлієвий мінімалізм",
    mood: "спокійна, природна, стримана",
    theme: {
      colors: { primary: "#5c7a5c", primaryForeground: "#ffffff", background: "#f7f9f5", foreground: "#2f3a2f", muted: "#d7e2d3", accent: "#e6efe2" },
      fonts: { heading: "serif", body: "sans" },
      radius: "md",
    },
  },
  "burgundy-elegant": {
    label: "Бордо-елегант",
    mood: "розкішна, глибока, вишукана",
    theme: {
      colors: { primary: "#7a2233", primaryForeground: "#fdf6ee", background: "#fdf9f4", foreground: "#33262a", muted: "#e6d5c9", accent: "#f0e4d8" },
      fonts: { heading: "display", body: "serif" },
      radius: "sm",
    },
  },
  "peach-soft": {
    label: "Ніжний персик",
    mood: "м'яка, привітна, сучасна",
    theme: {
      colors: { primary: "#a26442", primaryForeground: "#ffffff", background: "#fff9f4", foreground: "#40342c", muted: "#f3ddcb", accent: "#fbe8d8" },
      fonts: { heading: "rounded", body: "rounded" },
      radius: "xl",
    },
  },
  "warm-bakery": {
    label: "Тепла пекарня",
    mood: "затишна, апетитна, домашня",
    theme: {
      colors: { primary: "#8a5a2b", primaryForeground: "#fff8f0", background: "#fdf7ef", foreground: "#3a2c1e", muted: "#e8d8c4", accent: "#f2e6d4" },
      fonts: { heading: "rounded", body: "sans" },
      radius: "lg",
    },
  },
  "slate-professional": {
    label: "Професійний графіт",
    mood: "стримана, ділова, надійна",
    theme: {
      colors: { primary: "#334155", primaryForeground: "#ffffff", background: "#f8fafc", foreground: "#1e293b", muted: "#cbd5e1", accent: "#e2e8f0" },
      fonts: { heading: "serif", body: "sans" },
      radius: "sm",
    },
  },
  "navy-trust": {
    label: "Довіра-нейві",
    mood: "солідна, впевнена, професійна",
    theme: {
      colors: { primary: "#1e3a5f", primaryForeground: "#ffffff", background: "#f7f9fb", foreground: "#1a2b3c", muted: "#cdd8e3", accent: "#dde8f0" },
      fonts: { heading: "serif", body: "sans" },
      radius: "md",
    },
  },
  "bold-slate": {
    label: "Динамічний сервіс",
    mood: "енергійна, технічна, впевнена",
    theme: {
      colors: { primary: "#c74b0a", primaryForeground: "#ffffff", background: "#f8fafc", foreground: "#1f2937", muted: "#d1d5db", accent: "#fde4d3" },
      fonts: { heading: "sans", body: "sans" },
      radius: "md",
    },
  },
  "emerald-fresh": {
    label: "Свіжий смарагд",
    mood: "чиста, сучасна, дружня",
    theme: {
      colors: { primary: "#04855d", primaryForeground: "#ffffff", background: "#f6faf8", foreground: "#1f2e28", muted: "#cfe3d9", accent: "#ddefe6" },
      fonts: { heading: "sans", body: "sans" },
      radius: "md",
    },
  },
  // Faithful to artisan-bakery: warm amber on cream, display headings, soft lg radius.
  "amber-craft": {
    label: "Крафтова пекарня",
    mood: "тепла, крафтова, апетитна",
    theme: {
      colors: { primary: "#a16122", primaryForeground: "#fff8ef", background: "#fdf7ee", foreground: "#3a2c1c", muted: "#e9d8bf", accent: "#f4e7d0" },
      fonts: { heading: "display", body: "sans" },
      radius: "lg",
    },
  },
  // Faithful to organic-market: emerald, fully rounded fonts, generous xl radius.
  "organic-emerald": {
    label: "Органік-смарагд",
    mood: "природна, свіжа, дружня",
    theme: {
      colors: { primary: "#047857", primaryForeground: "#ffffff", background: "#f4faf6", foreground: "#1c2e26", muted: "#cfe6d8", accent: "#dcefe4" },
      fonts: { heading: "rounded", body: "rounded" },
      radius: "xl",
    },
  },
  // Faithful to whole-foods: fresh light green, clean sans, medium radius.
  "market-green": {
    label: "Свіжий маркет",
    mood: "чиста, свіжа, легка",
    theme: {
      colors: { primary: "#12853c", primaryForeground: "#ffffff", background: "#f7fbf5", foreground: "#1f2e1f", muted: "#d6e8cf", accent: "#e5f1dd" },
      fonts: { heading: "sans", body: "sans" },
      radius: "md",
    },
  },
  // Faithful to construction-pro: solid slate with a warm amber accent, tight sm radius.
  "construction-slate": {
    label: "Будівельний слейт",
    mood: "потужна, надійна, технічна",
    theme: {
      colors: { primary: "#1e293b", primaryForeground: "#ffffff", background: "#f8fafc", foreground: "#0f172a", muted: "#cbd5e1", accent: "#fde6c8" },
      fonts: { heading: "sans", body: "sans" },
      radius: "sm",
    },
  },
  // Faithful to dental-care: soft calm blue, airy sans, rounded xl radius.
  "clinic-blue": {
    label: "Спокійна клініка",
    mood: "спокійна, чиста, довірлива",
    theme: {
      colors: { primary: "#2875c3", primaryForeground: "#ffffff", background: "#f5f9fd", foreground: "#1e2b3a", muted: "#cfe0f0", accent: "#e0eaf8" },
      fonts: { heading: "sans", body: "sans" },
      radius: "xl",
    },
  },
  // design-template-main adapted LIGHT: near-white neutral, violet accent, tight sm radius.
  "studio-violet": {
    label: "Преміум-студія",
    mood: "мінімалістична, преміальна, сучасна",
    theme: {
      colors: { primary: "#7c3aed", primaryForeground: "#ffffff", background: "#fafafa", foreground: "#18181b", muted: "#e4e4e7", accent: "#ede9fe" },
      fonts: { heading: "sans", body: "sans" },
      radius: "sm",
    },
  },
  // WARM — сонячний медовий, тепла пекарня / кав'ярня.
  "honey-mustard": {
    label: "Медова гірчиця",
    mood: "тепла, сонячна, апетитна",
    theme: {
      colors: { primary: "#8f5f0b", primaryForeground: "#fff9ec", background: "#fdf8ee", foreground: "#3a2e18", muted: "#ece0c4", accent: "#f6ecd2" },
      fonts: { heading: "rounded", body: "sans" },
      radius: "lg",
    },
  },
  // WARM — святковий вишневий, флористика / б'юті.
  "cherry-blush": {
    label: "Вишневий цвіт",
    mood: "яскрава, святкова, романтична",
    theme: {
      colors: { primary: "#b32639", primaryForeground: "#fff5f5", background: "#fff7f6", foreground: "#3a2124", muted: "#edcfd2", accent: "#f8dcdf" },
      fonts: { heading: "display", body: "serif" },
      radius: "lg",
    },
  },
  // EARTHY — глибокий ліс, преміальна ботаніка / еко.
  "deep-forest": {
    label: "Глибокий ліс",
    mood: "глибока, природна, шляхетна",
    theme: {
      colors: { primary: "#1f4d38", primaryForeground: "#f2f8f4", background: "#f4f8f5", foreground: "#1c2b23", muted: "#cfe0d5", accent: "#dcebe1" },
      fonts: { heading: "serif", body: "sans" },
      radius: "md",
    },
  },
  // EARTHY — теракота, крафтова кераміка / майстерня.
  "terracotta-clay": {
    label: "Теракота",
    mood: "земляна, крафтова, тепла",
    theme: {
      colors: { primary: "#a2472a", primaryForeground: "#fff5ef", background: "#fdf7f2", foreground: "#3a281f", muted: "#e9d4c5", accent: "#f3e2d5" },
      fonts: { heading: "display", body: "sans" },
      radius: "md",
    },
  },
  // NEUTRAL — графіт, мінімалістичний профі.
  "graphite-ink": {
    label: "Графіт",
    mood: "стримана, мінімалістична, ділова",
    theme: {
      colors: { primary: "#2f3438", primaryForeground: "#f5f6f7", background: "#f7f8f8", foreground: "#1c2023", muted: "#d7dade", accent: "#e6e8ea" },
      fonts: { heading: "sans", body: "sans" },
      radius: "sm",
    },
  },
  // NEUTRAL — тепла слонова кістка, витончений бутик.
  "ivory-linen": {
    label: "Слонова кістка",
    mood: "ніжна, тепло-нейтральна, витончена",
    theme: {
      colors: { primary: "#5a5148", primaryForeground: "#faf7f2", background: "#faf7f1", foreground: "#2b2620", muted: "#e6ded1", accent: "#efe8dc" },
      fonts: { heading: "serif", body: "sans" },
      radius: "md",
    },
  },
  // NEUTRAL — холодний камінь, архітектурний спокій.
  "stone-greige": {
    label: "Камінь",
    mood: "спокійна, нейтральна, сучасна",
    theme: {
      colors: { primary: "#57534e", primaryForeground: "#f7f6f4", background: "#f6f5f3", foreground: "#292524", muted: "#ddd9d4", accent: "#e9e6e1" },
      fonts: { heading: "serif", body: "sans" },
      radius: "sm",
    },
  },
  // COLD — денім, практична майстерня / сервіс.
  "denim-craft": {
    label: "Денім",
    mood: "впевнена, чиста, практична",
    theme: {
      colors: { primary: "#2c5578", primaryForeground: "#f2f7fb", background: "#f5f8fb", foreground: "#1c2b39", muted: "#cddbe7", accent: "#dde8f1" },
      fonts: { heading: "sans", body: "sans" },
      radius: "md",
    },
  },
  // COLD — провансальська лаванда, салон / spa.
  "lavender-provence": {
    label: "Прованська лаванда",
    mood: "ніжна, спокійна, лавандова",
    theme: {
      colors: { primary: "#6a5aa6", primaryForeground: "#f6f4fb", background: "#f8f7fc", foreground: "#2a2438", muted: "#dcd6ec", accent: "#e8e3f4" },
      fonts: { heading: "rounded", body: "rounded" },
      radius: "xl",
    },
  },
  // CONTRAST — насичена слива на майже-білому, смілива б'юті.
  "plum-pop": {
    label: "Слива",
    mood: "смілива, розкішна, виразна",
    theme: {
      colors: { primary: "#93286b", primaryForeground: "#fdf2f9", background: "#faf7f9", foreground: "#241a20", muted: "#e6d2e0", accent: "#f3e2ee" },
      fonts: { heading: "display", body: "sans" },
      radius: "md",
    },
  },
  // CONTRAST — петроль-тіл на майже-білому, сучасний сервіс.
  "petrol-pop": {
    label: "Петроль",
    mood: "сучасна, енергійна, технологічна",
    theme: {
      colors: { primary: "#0d6e78", primaryForeground: "#eefafa", background: "#f5f9f9", foreground: "#14282a", muted: "#cbe1e2", accent: "#dcedee" },
      fonts: { heading: "sans", body: "sans" },
      radius: "sm",
    },
  },
};

export function resolveTheme(id: string): Theme {
  const preset = (themePresets as Record<string, PresetEntry>)[id];
  return preset ? preset.theme : themePresets["rose-classic"].theme;
}

/**
 * Perceptual palette FAMILY per preset (design-DNA wave 1). The re-roll
 * distinctness guarantee works on families — «інша сімʼя», not «сусідній
 * відтінок». Kept as a colocated map (not a per-entry field) so adding a
 * preset without a family is a type error here, not a silent hole.
 */
export const PRESET_FAMILIES: Record<ThemePresetId, PaletteFamily> = {
  "rose-classic": "warm",
  "peach-soft": "warm",
  "warm-bakery": "warm",
  "burgundy-elegant": "warm",
  "honey-mustard": "warm",
  "cherry-blush": "warm",
  "amber-craft": "earthy",
  "sage-minimal": "earthy",
  "organic-emerald": "earthy",
  "market-green": "earthy",
  "deep-forest": "earthy",
  "terracotta-clay": "earthy",
  "construction-slate": "neutral",
  "graphite-ink": "neutral",
  "ivory-linen": "neutral",
  "stone-greige": "neutral",
  "slate-professional": "cold",
  "navy-trust": "cold",
  "clinic-blue": "cold",
  "emerald-fresh": "cold",
  "denim-craft": "cold",
  "lavender-provence": "cold",
  "bold-slate": "contrast",
  "studio-violet": "contrast",
  "plum-pop": "contrast",
  "petrol-pop": "contrast",
};

export function presetFamily(id: string): PaletteFamily | undefined {
  return (PRESET_FAMILIES as Record<string, PaletteFamily>)[id];
}
