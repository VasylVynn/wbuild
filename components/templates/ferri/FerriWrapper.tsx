"use client";

import { useState, useEffect, type ReactNode } from "react";
import type { TemplateBrand } from "@/lib/templates/registry";
import { Cormorant_Garamond } from "next/font/google";
import "./ferri.css";
import FerriNav from "./FerriNav";
import FerriFooter from "./FerriFooter";

/*
 * Ferri wrapper — scopes the whole ported design under `.tpl-ferri` and owns the
 * template's THEME. Colours are CSS vars (ferri.css); dark is the default and
 * `data-theme="light"` flips every var for this subtree only. This wrapper is
 * the per-template theming FOUNDATION: it holds the current theme, persists the
 * visitor's choice, and renders a floating toggle. A generated tenant site will
 * later seed the default from `brand.themeMode`; for the preview, `?theme=light`
 * forces a theme so both can be screenshotted.
 *
 * Client component on purpose (theme state). The ported serif, Cormorant
 * Garamond, is loaded via next/font and exposed as `--font-cormorant`. It stays
 * loaded as the fallback: sections read the display font through the
 * `--ferri-display` indirection (ferri.css), which prefers a shell-injected
 * design-DNA pair and falls back to Cormorant when no pair is rolled.
 */
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});

type Theme = "dark" | "light";
const STORE_KEY = "fs-tpl-theme";

export default function FerriWrapper({
  children,
  brand,
}: {
  children: ReactNode;
  brand?: TemplateBrand;
}) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    // Precedence: ?theme= (preview/testing) → stored choice → dark default.
    let next: Theme = "dark";
    try {
      const param = new URLSearchParams(window.location.search).get("theme");
      const stored = window.localStorage.getItem(STORE_KEY);
      if (param === "light" || param === "dark") next = param;
      else if (stored === "light" || stored === "dark") next = stored;
    } catch {
      /* SSR / blocked storage — stay dark */
    }
    setTheme(next);
  }, []);

  const toggle = () =>
    setTheme((t) => {
      const next: Theme = t === "dark" ? "light" : "dark";
      try {
        window.localStorage.setItem(STORE_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });

  return (
    <div className={`tpl-ferri ${cormorant.variable}`} data-theme={theme}>
      <FerriNav
        brandName={brand?.brandName}
        brandAccent={brand?.brandAccent}
        logoUrl={brand?.logoUrl}
        navLinks={brand?.navLinks}
        ctaHref={brand?.ctaHref}
      />
      {children}
      <FerriFooter
        brandName={brand?.brandName}
        brandAccent={brand?.brandAccent}
        navLinks={brand?.navLinks}
        contact={brand?.contact}
      />

      <button
        type="button"
        onClick={toggle}
        aria-label={theme === "dark" ? "Увімкнути світлу тему" : "Увімкнути темну тему"}
        className="fixed bottom-5 right-5 z-[60] flex h-11 w-11 items-center justify-center border border-gold-500/30 bg-navy-950/80 text-gold-500 backdrop-blur-sm transition-colors hover:border-gold-500 hover:bg-gold-500/10"
      >
        {theme === "dark" ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        )}
      </button>
    </div>
  );
}
