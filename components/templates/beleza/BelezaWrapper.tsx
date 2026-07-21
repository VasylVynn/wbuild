import type { ReactNode } from "react";
import type { TemplateBrand } from "@/lib/templates/registry";
import { Comfortaa, Nunito } from "next/font/google";
import "./beleza.css";
import BelezaNav from "./BelezaNav";
import BelezaFooter from "./BelezaFooter";

/*
 * Beleza wrapper — the single element that scopes the ported beauty-space
 * design system under `.tpl-beleza` and hosts the chrome (Nav/Footer) around
 * the section children.
 *
 * Fonts: the source's OpenRunde (a rounded geometric sans) has NO Cyrillic
 * subset and is not a Google font, so the whole rounded look is carried by two
 * Cyrillic-capable substitutes loaded via next/font:
 *   - Comfortaa (rounded display) -> --font-beleza-display
 *   - Nunito   (rounded body)     -> --font-beleza-body
 * beleza.css binds those through the --beleza-display / --beleza-body
 * indirections so a shell-rolled DNA pair still wins. `preload: false` because
 * these are tenant-render fonts, not platform-chrome fonts.
 *
 * Single LIGHT theme (the source is light-only) → a plain server component:
 * no state, no data-theme toggle, so the next/font call stays on the server and
 * the animated (client) sections mount underneath it.
 */
const comfortaa = Comfortaa({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-beleza-display",
  display: "swap",
  preload: false,
});
const nunito = Nunito({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-beleza-body",
  display: "swap",
  preload: false,
});

export default function BelezaWrapper({
  children,
  brand,
}: {
  children: ReactNode;
  brand?: TemplateBrand;
}) {
  return (
    <div className={`tpl-beleza ${comfortaa.variable} ${nunito.variable}`}>
      <BelezaNav
        brandName={brand?.brandName}
        brandAccent={brand?.brandAccent}
        logoUrl={brand?.logoUrl}
        navLinks={brand?.navLinks}
        ctaHref={brand?.ctaHref}
      />
      {children}
      <BelezaFooter
        brandName={brand?.brandName}
        brandAccent={brand?.brandAccent}
        navLinks={brand?.navLinks}
        contact={brand?.contact}
      />
    </div>
  );
}
