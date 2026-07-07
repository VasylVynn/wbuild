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
};

export function resolveTheme(id: string): Theme {
  const preset = (themePresets as Record<string, PresetEntry>)[id];
  return preset ? preset.theme : themePresets["rose-classic"].theme;
}
