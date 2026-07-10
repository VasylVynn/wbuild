import type { Theme } from "./tokens";

/**
 * Curated theme presets across verticals. Generation picks ONE (by id) from the
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
      colors: { primary: "#e08a5c", primaryForeground: "#ffffff", background: "#fff9f4", foreground: "#40342c", muted: "#f3ddcb", accent: "#fbe8d8" },
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
      colors: { primary: "#ea580c", primaryForeground: "#ffffff", background: "#f8fafc", foreground: "#1f2937", muted: "#d1d5db", accent: "#fde4d3" },
      fonts: { heading: "sans", body: "sans" },
      radius: "md",
    },
  },
  "emerald-fresh": {
    label: "Свіжий смарагд",
    mood: "чиста, сучасна, дружня",
    theme: {
      colors: { primary: "#059669", primaryForeground: "#ffffff", background: "#f6faf8", foreground: "#1f2e28", muted: "#cfe3d9", accent: "#ddefe6" },
      fonts: { heading: "sans", body: "sans" },
      radius: "md",
    },
  },
  // Faithful to artisan-bakery: warm amber on cream, display headings, soft lg radius.
  "amber-craft": {
    label: "Крафтова пекарня",
    mood: "тепла, крафтова, апетитна",
    theme: {
      colors: { primary: "#a86523", primaryForeground: "#fff8ef", background: "#fdf7ee", foreground: "#3a2c1c", muted: "#e9d8bf", accent: "#f4e7d0" },
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
      colors: { primary: "#16a34a", primaryForeground: "#ffffff", background: "#f7fbf5", foreground: "#1f2e1f", muted: "#d6e8cf", accent: "#e5f1dd" },
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
      colors: { primary: "#2b7fd4", primaryForeground: "#ffffff", background: "#f5f9fd", foreground: "#1e2b3a", muted: "#cfe0f0", accent: "#e0eaf8" },
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
};

export function resolveTheme(id: string): Theme {
  const preset = (themePresets as Record<string, PresetEntry>)[id];
  return preset ? preset.theme : themePresets["rose-classic"].theme;
}
