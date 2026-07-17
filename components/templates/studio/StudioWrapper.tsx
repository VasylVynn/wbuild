import type { ReactNode } from "react";
import type { TemplateBrand } from "@/lib/templates/registry";
import { Inter } from "next/font/google";
import "./studio.css";
import StudioNav from "./StudioNav";
import StudioFooter from "./StudioFooter";

/*
 * Studio template wrapper — the single element that scopes the whole ported
 * design system:
 *  - loads Inter (the source's typeface) via next/font, subsetted for the
 *    Ukrainian content (latin + cyrillic), exposed as `--font-inter` which
 *    studio.css binds to `--font-sans`;
 *  - applies `.tpl-studio`, which carries the dark background, colour, and all
 *    the source CSS vars so every child section renders on the correct canvas;
 *  - renders the fixed noise overlay (ported NoiseOverlay — a static div, no
 *    client boundary needed), plus the ported chrome (StudioNav fixed header +
 *    StudioFooter) around the section children.
 *
 * Server component on purpose: it holds no state, so the next/font call stays
 * on the server and the animated (client) sections mount underneath it.
 */
const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
  display: "swap",
});

export default function StudioWrapper({
  children,
  brand,
}: {
  children: ReactNode;
  brand?: TemplateBrand;
}) {
  return (
    <div className={`tpl-studio ${inter.variable}`}>
      <div className="noise-overlay" aria-hidden="true" />
      <StudioNav
        brandName={brand?.brandName}
        brandAccent={brand?.brandAccent}
        logoUrl={brand?.logoUrl}
        navLinks={brand?.navLinks}
        ctaHref={brand?.ctaHref}
      />
      {children}
      <StudioFooter
        brandName={brand?.brandName}
        brandAccent={brand?.brandAccent}
        navLinks={brand?.navLinks}
        contact={brand?.contact}
      />
    </div>
  );
}
