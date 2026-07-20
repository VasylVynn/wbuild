import type { CSSProperties } from "react";
import { z } from "zod";
import { resolveFontPair } from "./font-pairs";
import { designDnaSchema } from "./dna";

/**
 * Theme = design tokens, stored SEPARATELY from content (brief §4.5).
 * Blocks NEVER hardcode colors/fonts — they read CSS variables produced by
 * `themeToCssVars`, set once on the tenant shell. "Regenerate the design
 * without touching content" = swap this object, leave `blocks` untouched.
 * The AI, when designing, returns ONLY a `theme` object matching this schema.
 */

const hexColor = z
  .string()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "must be a hex color like #1a2b3c");

export const FONT_FAMILIES = ["sans", "serif", "display", "rounded"] as const;
export type FontFamily = (typeof FONT_FAMILIES)[number];

export const RADII = ["none", "sm", "md", "lg", "xl", "full"] as const;
export type Radius = (typeof RADII)[number];

export const themeSchema = z.object({
  colors: z.object({
    primary: hexColor,
    primaryForeground: hexColor,
    background: hexColor,
    foreground: hexColor,
    muted: hexColor,
    accent: hexColor,
  }),
  fonts: z.object({
    heading: z.enum(FONT_FAMILIES),
    body: z.enum(FONT_FAMILIES),
  }),
  radius: z.enum(RADII),
  // Design-DNA wave 1: a curated Cyrillic pair (lib/theme/font-pairs.ts)
  // overrides the role-based fonts above. Optional + lenient so every stored
  // theme (draft or published) keeps validating; unknown ids fall back to the
  // legacy role stacks at resolve time — never at parse time.
  fontPairId: z.string().optional(),
  // The full style genome that produced this theme (lib/theme/dna.ts) —
  // versioned with the theme (draft→published), optional for every pre-DNA row.
  dna: designDnaSchema.optional(),
});
export type Theme = z.infer<typeof themeSchema>;

/**
 * Legacy role → stack mapping. The var(--font-*) references resolve because
 * tenant shells attach TENANT_FONT_CLASSES (lib/theme/fonts.ts) + the root
 * layout's Manrope/Unbounded — BEFORE design-DNA these named families were
 * declared but never loaded, so every preset silently fell back to
 * Georgia/system (the «all sites look the same» root cause, research doc).
 */
const FONT_STACK: Record<FontFamily, string> = {
  sans: "var(--font-manrope), ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
  serif: "var(--font-lora), ui-serif, Georgia, Cambria, Times New Roman, serif",
  display: "var(--font-playfair), ui-serif, Georgia, serif",
  rounded: "var(--font-nunito), ui-rounded, 'Segoe UI', system-ui, sans-serif",
};

const RADIUS_SCALE: Record<Radius, string> = {
  none: "0",
  sm: "0.25rem",
  md: "0.5rem",
  lg: "0.75rem",
  xl: "1rem",
  full: "9999px",
};

/**
 * Convert a theme into CSS custom properties. Spread the result onto the
 * `style` prop of the tenant shell; blocks reference `var(--color-primary)`
 * etc. via Tailwind arbitrary values or inline styles.
 */
export function themeToCssVars(theme: Theme): CSSProperties {
  const pair = resolveFontPair(theme.fontPairId);
  return {
    "--color-primary": theme.colors.primary,
    "--color-primary-foreground": theme.colors.primaryForeground,
    "--color-background": theme.colors.background,
    "--color-foreground": theme.colors.foreground,
    "--color-muted": theme.colors.muted,
    // Readable secondary-text color (muted is a light tint for borders/fills,
    // NOT for text). Derived from foreground so contrast holds on every theme.
    "--color-muted-foreground": `color-mix(in srgb, ${theme.colors.foreground} 64%, ${theme.colors.background})`,
    "--color-accent": theme.colors.accent,
    "--font-heading": pair?.heading ?? FONT_STACK[theme.fonts.heading],
    "--font-body": pair?.body ?? FONT_STACK[theme.fonts.body],
    "--radius": RADIUS_SCALE[theme.radius],
  } as CSSProperties;
}
