"use client";

import { useState, useEffect, type ReactNode } from "react";
import type { TemplateBrand } from "@/lib/templates/registry";
import { Inter, JetBrains_Mono } from "next/font/google";
import SparkNav from "./SparkNav";
import SparkFooter from "./SparkFooter";
import "./spark.css";

/*
 * Spark wrapper — scopes the clean universal-modern look under `.tpl-spark` and
 * owns the template's THEME. Spark ships LIGHT (default) + DARK; colours are CSS
 * vars (spark.css) flipped by `data-theme` (SalonWrapper mechanics: initial from
 * brand.dnaTheme, `?theme=` / stored toggle wins, floating visitor toggle).
 *
 * Fonts (the source's own): Inter for display+body (headings are just Inter at
 * medium weight — the source is single-family) exposed as --font-spark-sans, and
 * JetBrains Mono (has Cyrillic) for the signature mono eyebrow/number accents as
 * --font-spark-mono. Both preload:false, display swap, latin+cyrillic. The
 * scope's --spark-display/--spark-body indirections prefer a DNA-injected pair.
 */
const inter = Inter({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
  variable: "--font-spark-sans",
  display: "swap",
  preload: false,
});
const mono = JetBrains_Mono({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500"],
  variable: "--font-spark-mono",
  display: "swap",
  preload: false,
});

type Theme = "light" | "dark";
const STORE_KEY = "spark-tpl-theme";

export default function SparkWrapper({
  children,
  brand,
}: {
  children: ReactNode;
  brand?: TemplateBrand;
}) {
  const [theme, setTheme] = useState<Theme>(brand?.dnaTheme === "dark" ? "dark" : "light");

  const dnaTheme: Theme | undefined =
    brand?.dnaTheme === "dark" || brand?.dnaTheme === "light" ? brand.dnaTheme : undefined;

  useEffect(() => {
    let next: Theme = dnaTheme ?? "light";
    try {
      const param = new URLSearchParams(window.location.search).get("theme");
      const stored = window.localStorage.getItem(STORE_KEY);
      if (param === "light" || param === "dark") next = param;
      else if (stored === "light" || stored === "dark") next = stored;
    } catch {
      /* ignore */
    }
    setTheme(next);
  }, [dnaTheme]);

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
    <div className={`tpl-spark ${inter.variable} ${mono.variable}`} data-theme={theme}>
      <SparkNav
        brandName={brand?.brandName}
        brandAccent={brand?.brandAccent}
        logoUrl={brand?.logoUrl}
        navLinks={brand?.navLinks}
        ctaHref={brand?.ctaHref}
      />
      {children}
      <SparkFooter
        brandName={brand?.brandName}
        brandAccent={brand?.brandAccent}
        navLinks={brand?.navLinks}
        contact={brand?.contact}
      />

      <button
        type="button"
        onClick={toggle}
        aria-label={theme === "light" ? "Увімкнути темну тему" : "Увімкнути світлу тему"}
        className="fixed bottom-5 right-5 z-[60] flex h-11 w-11 items-center justify-center rounded-full border border-[var(--spark-border)] bg-[var(--spark-bg)]/80 text-[var(--spark-fg)] shadow-[var(--spark-shadow)] backdrop-blur-md transition-colors hover:border-[var(--spark-fg)]"
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
