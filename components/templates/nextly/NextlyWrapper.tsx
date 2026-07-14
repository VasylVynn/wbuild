"use client";

import { useState, useEffect, type ReactNode } from "react";
import type { TemplateBrand } from "@/lib/templates/registry";
import { Inter } from "next/font/google";
import NextlyNav from "./NextlyNav";
import NextlyFooter from "./NextlyFooter";

/*
 * Nextly wrapper — scopes the ported "nextly" look (clean indigo marketing) under
 * `.tpl-nextly` and owns the template's THEME. Nextly ships LIGHT (default) +
 * DARK; the sections use standard Tailwind colours + `dark:` utilities bound to
 * `.tpl-nextly[data-theme="dark"]` (custom variant in globals.css), and the scope
 * sets the base surface. Font: Inter (has Cyrillic) via next/font as
 * --font-nextly. `?theme=dark` forces a theme for preview screenshots; a floating
 * toggle lets a visitor switch.
 */
const inter = Inter({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-nextly",
  display: "swap",
});

type Theme = "light" | "dark";
const STORE_KEY = "nextly-tpl-theme";

export default function NextlyWrapper({
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
    <div className={`tpl-nextly ${inter.variable}`} data-theme={theme}>
      <NextlyNav
        brandName={brand?.brandName}
        brandAccent={brand?.brandAccent}
        navLinks={brand?.navLinks}
        ctaHref={brand?.ctaHref}
      />
      <div>{children}</div>
      <NextlyFooter
        brandName={brand?.brandName}
        brandAccent={brand?.brandAccent}
        navLinks={brand?.navLinks}
        contact={brand?.contact}
      />

      <button
        type="button"
        onClick={toggle}
        aria-label={theme === "light" ? "Увімкнути темну тему" : "Увімкнути світлу тему"}
        className="fixed bottom-5 right-5 z-[60] flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-white/80 text-indigo-600 shadow-lg backdrop-blur-md transition-colors hover:border-indigo-400 dark:border-gray-700 dark:bg-gray-800/80 dark:text-indigo-400 dark:hover:border-indigo-500"
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
