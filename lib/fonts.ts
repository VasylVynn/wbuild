/**
 * Font registry — SELF-HOSTED since 2026-08-12.
 *
 * This module used to hold fourteen next/font/google loaders. Google rotates
 * the files behind fonts.gstatic.com, and any warm cache that remembered the
 * old URLs then requested 404s: the Vercel deploy failed twice (Playfair) and
 * local dev broke once (Nunito) inside one week, each time looking like a
 * different bug («Module not found», 500s on the tenant root). The fonts now
 * live in the repo — `scripts/vendor-fonts.mjs` downloads them into
 * public/fonts/ and writes app/fonts.css, which the root layout imports.
 *
 * app/fonts.css owns BOTH halves of the old loaders' job:
 *   - @font-face blocks (Google's own css2 output, unicode-range subsetting
 *     intact, URLs rewritten to /fonts/…);
 *   - a :root block mapping every --font-* variable to its family name, which
 *     is why no per-layout className attachment exists any more — the
 *     variables are global, and only pages whose CSS actually references a
 *     family download its files.
 *
 * The lists below are the CONTRACT the rest of the product reads: the
 * font-pair whitelist (lib/design/font-pairs.ts) may only reference these
 * variables, and lib/design/font-pairs.test.ts checks them against
 * app/fonts.css — a family removed from the css without leaving these lists
 * (or vice versa) fails the suite.
 *
 * All families verified to ship a true `cyrillic` subset (ґ/є/і/ї —
 * U+0490-0491 + U+0400-045F are inside Google's cyrillic unicode-range).
 */

/** Families a tenant's designSpec may pick (lib/design/font-pairs.ts). */
export const TENANT_FONT_VARIABLES = [
  "--font-inter",
  "--font-montserrat",
  "--font-rubik",
  "--font-lora",
  "--font-source-sans",
  "--font-literata",
  "--font-cormorant",
  "--font-nunito",
  "--font-nunito-sans",
  "--font-playfair",
  "--font-jost",
  "--font-onest",
] as const;

/** The platform's own brand pair (landing, dashboard chrome). */
export const PLATFORM_FONT_VARIABLES = ["--font-manrope", "--font-unbounded"] as const;
