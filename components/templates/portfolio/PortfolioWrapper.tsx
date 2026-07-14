import type { ReactNode } from "react";
import type { TemplateBrand } from "@/lib/templates/registry";
import { Inter, Playfair_Display } from "next/font/google";
import PortfolioNav from "./PortfolioNav";
import PortfolioFooter from "./PortfolioFooter";

/*
 * Portfolio ("portfolio-ui-6") wrapper — scopes the dark-teal design under
 * `.tpl-portfolio` (colours + glass/glow + CSS animations live in globals.css)
 * and renders the chrome (Nav/Footer) around the section children. Single dark
 * theme → a plain server component (no theme state). Fonts: Inter (body) +
 * Playfair Display (serif accent), both with Cyrillic, exposed as
 * --font-portfolio-sans / --font-portfolio-serif.
 */
const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-portfolio-sans",
  display: "swap",
});
const playfair = Playfair_Display({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-portfolio-serif",
  display: "swap",
});

export default function PortfolioWrapper({
  children,
  brand,
}: {
  children: ReactNode;
  brand?: TemplateBrand;
}) {
  return (
    <div className={`tpl-portfolio ${inter.variable} ${playfair.variable}`}>
      <PortfolioNav
        brandName={brand?.brandName}
        brandAccent={brand?.brandAccent}
        navLinks={brand?.navLinks}
        ctaHref={brand?.ctaHref}
      />
      {children}
      <PortfolioFooter
        brandName={brand?.brandName}
        brandAccent={brand?.brandAccent}
        navLinks={brand?.navLinks}
        contact={brand?.contact}
      />
    </div>
  );
}
