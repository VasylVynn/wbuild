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
 * next/font loaders for the curated pairs (lib/theme/font-pairs.ts). Imported
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
