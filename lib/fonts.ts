import {
  Inter,
  Montserrat,
  Rubik,
  Lora,
  Source_Sans_3,
  Literata,
  Cormorant_Garamond,
  Nunito,
  Nunito_Sans,
  Playfair_Display,
  Jost,
  Onest,
} from "next/font/google";

/**
 * next/font loaders for the curated pairs (lib/design/font-pairs.ts). Imported
 * ONLY by tenant-rendering layouts (public shell + editor frame) — attaching
 * TENANT_FONT_CLASSES registers every family's @font-face + CSS variable.
 *
 * `preload: false` everywhere: the browser downloads a family's woff2 ONLY
 * when applied CSS actually references its variable, so a tenant pays bytes
 * for its chosen pair alone; unused families cost just the @font-face rules.
 * The platform's own pair (Manrope/Unbounded in the root layout) keeps its
 * preloading behavior there. Trade-off (research doc, addendum #5): the
 * chosen pair swaps in after first paint (FOUT) — accepted, measured in E2E.
 *
 * All families verified to ship a true `cyrillic` subset (ґ/є/і/ї —
 * U+0490-0491 + U+0400-045F are inside Google's cyrillic unicode-range).
 */

// Manrope and Unbounded are NOT declared here: the root layout already
// registers --font-manrope/--font-unbounded on <html> (global), and pairs
// reference those variables directly.
const inter = Inter({ subsets: ["latin", "cyrillic"], display: "swap", preload: false, variable: "--font-inter" });
const montserrat = Montserrat({ subsets: ["latin", "cyrillic"], display: "swap", preload: false, variable: "--font-montserrat" });
const rubik = Rubik({ subsets: ["latin", "cyrillic"], display: "swap", preload: false, variable: "--font-rubik" });
const lora = Lora({ subsets: ["latin", "cyrillic"], display: "swap", preload: false, variable: "--font-lora" });
const sourceSans = Source_Sans_3({ subsets: ["latin", "cyrillic"], display: "swap", preload: false, variable: "--font-source-sans" });
const literata = Literata({ subsets: ["latin", "cyrillic"], display: "swap", preload: false, variable: "--font-literata" });
const cormorant = Cormorant_Garamond({ subsets: ["latin", "cyrillic"], weight: ["400", "500", "600", "700"], display: "swap", preload: false, variable: "--font-cormorant" });
const nunito = Nunito({ subsets: ["latin", "cyrillic"], display: "swap", preload: false, variable: "--font-nunito" });
const nunitoSans = Nunito_Sans({ subsets: ["latin", "cyrillic"], display: "swap", preload: false, variable: "--font-nunito-sans" });
const playfair = Playfair_Display({ subsets: ["latin", "cyrillic"], display: "swap", preload: false, variable: "--font-playfair" });
const jost = Jost({ subsets: ["latin", "cyrillic"], display: "swap", preload: false, variable: "--font-jost" });
const onest = Onest({ subsets: ["latin", "cyrillic"], display: "swap", preload: false, variable: "--font-onest" });

/**
 * CSS custom properties the loaders above register — kept as LITERALS because
 * next/font loader options must be statically analyzable, so nothing here can
 * be derived from a shared constant. The whitelist (lib/design/font-pairs.ts)
 * may only reference these plus the two root-layout globals; the vitest in
 * lib/design/font-pairs.test.ts source-checks both mirrors, since this module
 * cannot be imported outside the Next compiler.
 */
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

/** Registered globally by app/layout.tsx on <html> — see header note. */
export const PLATFORM_FONT_VARIABLES = ["--font-manrope", "--font-unbounded"] as const;

/** Attach on every tenant-rendering shell (public layout + editor frame). */
export const TENANT_FONT_CLASSES = [
  inter,
  montserrat,
  rubik,
  lora,
  sourceSans,
  literata,
  cormorant,
  nunito,
  nunitoSans,
  playfair,
  jost,
  onest,
]
  .map((f) => f.variable)
  .join(" ");
