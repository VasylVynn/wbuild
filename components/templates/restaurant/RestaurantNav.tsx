"use client";

import { useState } from "react";

type NavLink = { href: string; label: string };

/*
 * Nav — CHROME (no block/schema — rendered by RestaurantWrapper around every
 * page). Ported from components/templates/aisaas/AiSaasNav.tsx, same prop
 * signature ({ brandName?, brandAccent?, navLinks?, ctaHref? } — matching
 * TemplateBrand exactly, which is all RestaurantWrapper ever passes) and the
 * same mobile hamburger → dropdown-card behaviour. Restyled to the warm
 * hospitality system: a permanently-sticky translucent cream bar with a warm
 * hairline border (no scroll-triggered transparency like the source — the
 * restaurant hero doesn't reserve space for a floating/fixed bar).
 */
export default function RestaurantNav({
  brandName = "Смак",
  brandAccent = "Дому",
  logoUrl,
  navLinks = [
    { href: "#services", label: "Меню" },
    { href: "#gallery", label: "Галерея" },
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
      className="sticky top-0 z-50 border-b border-[#E7DCCB] bg-[#FBF6EF]/90 backdrop-blur"
    >
      <div className="mx-auto grid max-w-6xl grid-cols-2 items-center px-4 py-4 sm:px-6 md:grid-cols-3">
        <a href="/" className="flex items-center gap-2 font-display text-xl font-bold tracking-tight text-[#2A2018]">
          {logoUrl && <img src={logoUrl} alt="" className="h-8 w-auto max-w-[160px] shrink-0 object-contain" />}
          <span className="truncate max-w-[220px] md:max-w-[320px]">
            {brandName}
            <span className="text-[#C0562F]">{brandAccent}</span>
          </span>
        </a>

        <div className="hidden items-center justify-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a key={link.href} href={link.href} className="text-sm font-medium text-[#6F6257] transition-colors hover:text-[#C0562F]">
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden justify-end md:flex">
          <a href={ctaHref} className="rounded-full bg-[#C0562F] px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#9E4423]">
            Забронювати столик
          </a>
        </div>

        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="justify-self-end text-[#2A2018] md:hidden"
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
        <div className="mx-4 mb-4 flex flex-col gap-1 rounded-3xl border border-[#E7DCCB] bg-white p-4 shadow-lg md:hidden">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="rounded-2xl px-3 py-2.5 text-sm font-medium text-[#2A2018] transition-colors hover:bg-[#F3EADD]"
            >
              {link.label}
            </a>
          ))}
          <a
            href={ctaHref}
            onClick={() => setMobileOpen(false)}
            className="mt-2 rounded-full bg-[#C0562F] px-5 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-[#9E4423]"
          >
            Забронювати столик
          </a>
        </div>
      )}
    </nav>
  );
}
