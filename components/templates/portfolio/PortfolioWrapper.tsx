import type { ReactNode } from "react";
import type { TemplateBrand } from "@/lib/templates/registry";
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
export default function PortfolioWrapper({
  children,
  brand,
}: {
  children: ReactNode;
  brand?: TemplateBrand;
}) {
  return (
    <div className="tpl-portfolio" style={{ "--font-portfolio-sans": "'Inter'", "--font-portfolio-serif": "'Playfair Display'" } as React.CSSProperties}>
      <PortfolioNav
        brandName={brand?.brandName}
        brandAccent={brand?.brandAccent}
        logoUrl={brand?.logoUrl}
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
