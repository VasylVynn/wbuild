import type { CSSProperties } from "react";
import { z } from "zod";

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
});
export type Theme = z.infer<typeof themeSchema>;

const FONT_STACK: Record<FontFamily, string> = {
  sans: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
  serif: "ui-serif, Georgia, Cambria, Times New Roman, serif",
  display: '"Playfair Display", ui-serif, Georgia, serif',
  rounded: '"Nunito", ui-rounded, "Segoe UI", system-ui, sans-serif',
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
    "--font-heading": FONT_STACK[theme.fonts.heading],
    "--font-body": FONT_STACK[theme.fonts.body],
    "--radius": RADIUS_SCALE[theme.radius],
  } as CSSProperties;
}
