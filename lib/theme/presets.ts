import type { Theme } from "./tokens";

/**
 * Curated florist theme presets. Generation picks ONE by id (an enum) rather
 * than free-generating hex colors — robust (no color hallucination), aligned
 * with switchTemplate (§4.7: theme comes from the preset), and the variety the
 * owner wants lives in the SECTIONS, not arbitrary colors. `mood` is shown to
 * the model so it can choose a fitting palette.
 */
export const THEME_PRESET_IDS = [
  "rose-classic",
  "sage-minimal",
  "burgundy-elegant",
  "peach-soft",
] as const;
export type ThemePresetId = (typeof THEME_PRESET_IDS)[number];

export const themePresets: Record<ThemePresetId, { label: string; mood: string; theme: Theme }> = {
  "rose-classic": {
    label: "Класична троянда",
    mood: "тепла, романтична, класична",
    theme: {
      colors: {
        primary: "#b23a58",
        primaryForeground: "#fff8f6",
        background: "#fff8f6",
        foreground: "#3a2b2f",
        muted: "#e7d3d8",
        accent: "#f3e1e6",
      },
      fonts: { heading: "display", body: "sans" },
      radius: "lg",
    },
  },
  "sage-minimal": {
    label: "Шавлієвий мінімалізм",
    mood: "спокійна, природна, стримана",
    theme: {
      colors: {
        primary: "#5c7a5c",
        primaryForeground: "#ffffff",
        background: "#f7f9f5",
        foreground: "#2f3a2f",
        muted: "#d7e2d3",
        accent: "#e6efe2",
      },
      fonts: { heading: "serif", body: "sans" },
      radius: "md",
    },
  },
  "burgundy-elegant": {
    label: "Бордо-елегант",
    mood: "розкішна, глибока, вишукана",
    theme: {
      colors: {
        primary: "#7a2233",
        primaryForeground: "#fdf6ee",
        background: "#fdf9f4",
        foreground: "#33262a",
        muted: "#e6d5c9",
        accent: "#f0e4d8",
      },
      fonts: { heading: "display", body: "serif" },
      radius: "sm",
    },
  },
  "peach-soft": {
    label: "Ніжний персик",
    mood: "м'яка, привітна, сучасна",
    theme: {
      colors: {
        primary: "#e08a5c",
        primaryForeground: "#ffffff",
        background: "#fff9f4",
        foreground: "#40342c",
        muted: "#f3ddcb",
        accent: "#fbe8d8",
      },
      fonts: { heading: "rounded", body: "rounded" },
      radius: "xl",
    },
  },
};

export function resolveTheme(id: string): Theme {
  const preset = (themePresets as Record<string, { theme: Theme }>)[id];
  return preset ? preset.theme : themePresets["rose-classic"].theme;
}
