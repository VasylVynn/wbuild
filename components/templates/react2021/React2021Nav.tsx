"use client";

import { useState } from "react";

type NavLink = { href: string; label: string };

/*
 * Nav — CHROME (no block/schema — rendered by React2021Wrapper around every
 * page). Port of the source Header.tsx's navbar shape (logo left, link row,
 * coral call-to-action), restyled to the energetic-coral system: a sticky
 * translucent white bar with a hamburger → dropdown card on mobile (the
 * source's Popover/Transition + heroicons Menu/X are swapped for plain
 * useState + inline SVGs). Prop signature matches AiSaasNav minus ctaLabel —
 * React2021Wrapper passes exactly { brandName, brandAccent, navLinks, ctaHref }.
 */
export default function React2021Nav({
  brandName = "Studio",
  brandAccent = "AI",
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
      className="sticky top-0 z-50 border-b border-gray-100 bg-white/90 backdrop-blur"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <a href="/" className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-[#1a2e35]">
          {logoUrl && <img src={logoUrl} alt="" className="h-8 w-auto" />}
          <span>
            {brandName}
            <span className="text-[#ec4755]">{brandAccent}</span>
          </span>
        </a>

        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a key={link.href} href={link.href} className="text-sm font-medium text-gray-600 transition-colors hover:text-[#1a2e35]">
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden md:block">
          <a href={ctaHref} className="rounded-md bg-[#ec4755] px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#a12c34]">
            Замовити
          </a>
        </div>

        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="text-[#1a2e35] md:hidden"
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
        <div className="mx-4 mb-4 flex flex-col gap-1 rounded-md border border-gray-100 bg-white p-4 shadow-md md:hidden">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="rounded-md px-3 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-[#1a2e35]"
            >
              {link.label}
            </a>
          ))}
          <a
            href={ctaHref}
            onClick={() => setMobileOpen(false)}
            className="mt-2 rounded-md bg-[#ec4755] px-6 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-[#a12c34]"
          >
            Замовити
          </a>
        </div>
      )}
    </nav>
  );
}
