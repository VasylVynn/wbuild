"use client";

import { useState, useEffect, type ReactNode } from "react";
import type { TemplateBrand } from "@/lib/templates/registry";
import { Playfair_Display, Poppins } from "next/font/google";
import SalonNav from "./SalonNav";
import SalonFooter from "./SalonFooter";

/*
 * Salon wrapper — scopes the ported "luxe-salon" look under `.tpl-salon` and owns
 * the template's THEME. Salon ships LIGHT (default) + DARK; colours are CSS vars
 * (app/salon-theme.css) flipped by data-theme, and the ported `dark:` utilities
 * are bound to `.tpl-salon[data-theme="dark"]` (custom variant in globals.css).
 * Fonts: Playfair Display (display serif — has Cyrillic) + Poppins (body), via
 * next/font as --font-playfair / --font-poppins. `?theme=dark` forces a theme for
 * preview screenshots; a floating toggle lets a visitor switch.
 */
const playfair = Playfair_Display({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
  display: "swap",
});
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-poppins",
  display: "swap",
});

type Theme = "light" | "dark";
const STORE_KEY = "salon-tpl-theme";

export default function SalonWrapper({
  children,
  brand,
}: {
  children: ReactNode;
  brand?: TemplateBrand;
}) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    let next: Theme = "light";
    try {
      const param = new URLSearchParams(window.location.search).get("theme");
      const stored = window.localStorage.getItem(STORE_KEY);
      if (param === "light" || param === "dark") next = param;
      else if (stored === "light" || stored === "dark") next = stored;
    } catch {
      /* ignore */
    }
    setTheme(next);
  }, []);

  const toggle = () =>
    setTheme((t) => {
      const next: Theme = t === "light" ? "dark" : "light";
      try {
        window.localStorage.setItem(STORE_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });

  return (
    <div className={`tpl-salon ${playfair.variable} ${poppins.variable}`} data-theme={theme}>
      <SalonNav
        brandName={brand?.brandName}
        brandAccent={brand?.brandAccent}
        navLinks={brand?.navLinks}
        ctaHref={brand?.ctaHref}
      />
      {children}
      <SalonFooter
        brandName={brand?.brandName}
        brandAccent={brand?.brandAccent}
        navLinks={brand?.navLinks}
        contact={brand?.contact}
      />

      <button
        type="button"
        onClick={toggle}
        aria-label={theme === "light" ? "Увімкнути темну тему" : "Увімкнути світлу тему"}
        className="fixed bottom-5 right-5 z-[60] flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background/80 text-accent shadow-elegant backdrop-blur-md transition-colors hover:border-accent"
      >
        {theme === "light" ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
          </svg>
        )}
      </button>
    </div>
  );
}
