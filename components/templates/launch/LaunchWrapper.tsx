"use client";

import { useState, useEffect, type ReactNode } from "react";
import type { TemplateBrand } from "@/lib/templates/registry";
import { Manrope, Inter } from "next/font/google";
import "./launch.css";
import LaunchNav from "./LaunchNav";
import LaunchFooter from "./LaunchFooter";

/*
 * Launch wrapper — scopes the ported Launch UI look under `.tpl-launch` and owns
 * the template's THEME. Launch ships DARK (default — the glow identity reads best
 * on near-black) + LIGHT; both are CSS-var value-sets in launch.css flipped by
 * `data-theme` on this root. Fonts via next/font as unique vars: Manrope
 * (display → --font-launch-display) + Inter (body → --font-launch-body), both
 * with a Cyrillic subset for Ukrainian copy. launch.css binds them through the
 * DE-FONTED --launch-display / --launch-body indirections (DNA pair wins first).
 * `?theme=` forces a theme for preview screenshots; a floating toggle lets a
 * visitor switch; the seeded brand.dnaTheme is the initial default.
 */
const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-launch-display",
  display: "swap",
  preload: false,
});
const inter = Inter({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-launch-body",
  display: "swap",
  preload: false,
});

type Theme = "light" | "dark";
const STORE_KEY = "launch-tpl-theme";

export default function LaunchWrapper({
  children,
  brand,
}: {
  children: ReactNode;
  brand?: TemplateBrand;
}) {
  // Default identity is DARK; an explicit light dnaTheme opts out.
  const [theme, setTheme] = useState<Theme>(
    brand?.dnaTheme === "light" ? "light" : "dark",
  );

  const dnaTheme: Theme | undefined =
    brand?.dnaTheme === "dark" || brand?.dnaTheme === "light" ? brand.dnaTheme : undefined;
  useEffect(() => {
    let next: Theme = dnaTheme ?? "dark";
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
    <div className={`tpl-launch ${manrope.variable} ${inter.variable}`} data-theme={theme}>
      <LaunchNav
        brandName={brand?.brandName}
        brandAccent={brand?.brandAccent}
        logoUrl={brand?.logoUrl}
        navLinks={brand?.navLinks}
        ctaHref={brand?.ctaHref}
      />
      {children}
      <LaunchFooter
        brandName={brand?.brandName}
        brandAccent={brand?.brandAccent}
        navLinks={brand?.navLinks}
        contact={brand?.contact}
      />

      <button
        type="button"
        onClick={toggle}
        aria-label={theme === "light" ? "Увімкнути темну тему" : "Увімкнути світлу тему"}
        className="fixed bottom-5 right-5 z-[60] flex h-11 w-11 items-center justify-center rounded-full border border-[var(--launch-border)] bg-[var(--launch-bg-2)]/80 text-[var(--launch-brand)] backdrop-blur-md transition-colors hover:border-[var(--launch-brand)]"
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
