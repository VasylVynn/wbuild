"use client";

import { useState } from "react";

type NavLink = { href: string; label: string };

/*
 * Nav — CHROME (no block/schema — rendered by NextlyWrapper around every
 * page). Port of the source nextly Navbar.tsx: sticky top bar, brand left,
 * centred anchor links, indigo CTA button right, mobile hamburger →
 * dropdown panel (the source's @headlessui/react Disclosure is swapped for
 * plain useState + inline SVGs). The source's hardcoded brand/nav links are
 * parameterised with UA demo defaults, matching the exact prop signature
 * NextlyWrapper calls: { brandName?, brandAccent?, navLinks?, ctaHref? }.
 */
export default function NextlyNav({
  brandName = "Nextly",
  brandAccent = "",
  logoUrl,
  navLinks = [
    { href: "#services", label: "Послуги" },
    { href: "#gallery", label: "Роботи" },
    { href: "#testimonials", label: "Відгуки" },
    { href: "#faq", label: "Питання" },
  ],
  ctaHref = "#lead_form",
}: {
  brandName?: string;
  brandAccent?: string;
  logoUrl?: string;
  navLinks?: NavLink[];
  ctaHref?: string;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav
      role="navigation"
      aria-label="Main navigation"
      className="sticky top-0 z-50 border-b border-gray-100 bg-white/90 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/90"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <a href="/" className="flex items-center gap-2 text-xl font-medium text-gray-800 dark:text-white">
          {logoUrl && <img src={logoUrl} alt="" className="h-8 w-auto max-w-[160px] shrink-0 object-contain" />}
          <span className="truncate max-w-[220px] md:max-w-[320px]">
            {brandName}
            {brandAccent && <span className="text-indigo-600"> {brandAccent}</span>}
          </span>
        </a>

        <div className="hidden items-center gap-8 lg:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-normal text-gray-600 transition-colors hover:text-indigo-600 dark:text-gray-300 dark:hover:text-indigo-400"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden lg:flex">
          <a href={ctaHref} className="rounded-md bg-indigo-600 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500">
            Почати
          </a>
        </div>

        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="text-gray-500 hover:text-indigo-500 dark:text-gray-300 lg:hidden"
          aria-label={mobileOpen ? "Закрити меню" : "Відкрити меню"}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {mobileOpen && (
        <div className="flex flex-wrap gap-1 border-t border-gray-100 bg-white px-4 py-4 dark:border-neutral-800 dark:bg-neutral-900 lg:hidden">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="w-full rounded-md px-4 py-2 text-sm text-gray-600 transition-colors hover:bg-indigo-50 hover:text-indigo-600 dark:text-gray-300 dark:hover:bg-neutral-800 dark:hover:text-indigo-400"
            >
              {link.label}
            </a>
          ))}
          <a
            href={ctaHref}
            onClick={() => setMobileOpen(false)}
            className="mt-3 w-full rounded-md bg-indigo-600 px-6 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-indigo-500"
          >
            Почати
          </a>
        </div>
      )}
    </nav>
  );
}
