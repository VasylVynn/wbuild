"use client";

import { useEffect, useState } from "react";

type NavLink = { href: string; label: string };

/*
 * Nav — CHROME (no block/schema — rendered by AiSaasWrapper around every
 * page). Port of the source AI-SaaS navbar.tsx: a fixed top bar, restyled to
 * the soft-pastel system — starts fully transparent over the hero and
 * condenses into a translucent white blurred bar once scrolled, with a
 * hamburger → dropdown card on mobile (the source's Menu/X lucide icons are
 * swapped for inline SVGs). The source's hardcoded brand/nav links are
 * parameterised with UA demo defaults so a generated site can override them.
 */
export default function AiSaasNav({
  brandName = "Studio",
  brandAccent = "AI",
  navLinks = [
    { href: "#services", label: "Послуги" },
    { href: "#gallery", label: "Роботи" },
    { href: "#testimonials", label: "Відгуки" },
    { href: "#faq", label: "Питання" },
  ],
  ctaLabel = "Почати",
  ctaHref = "#lead_form",
}: {
  brandName?: string;
  brandAccent?: string;
  navLinks?: NavLink[];
  ctaLabel?: string;
  ctaHref?: string;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      role="navigation"
      aria-label="Main navigation"
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-white/80 py-3 shadow-sm backdrop-blur-md" : "bg-transparent py-5"
      }`}
    >
      <div className="mx-auto grid max-w-6xl grid-cols-2 items-center px-4 sm:px-6 md:grid-cols-3">
        <a href="/" className="text-xl font-bold tracking-tight text-[#2F4550]">
          {brandName}
          <span className="text-[#E07A5F]">{brandAccent}</span>
        </a>

        <div className="hidden items-center justify-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a key={link.href} href={link.href} className="text-sm font-medium text-[#2F4550]/80 transition-colors hover:text-[#E07A5F]">
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden justify-end md:flex">
          <a href={ctaHref} className="rounded-full bg-[#E07A5F] px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90">
            {ctaLabel}
          </a>
        </div>

        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="justify-self-end text-[#2F4550] md:hidden"
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
        <div className="mx-4 mt-3 flex flex-col gap-1 rounded-3xl bg-white/95 p-4 shadow-lg backdrop-blur-md md:hidden">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="rounded-2xl px-3 py-2.5 text-sm font-medium text-[#2F4550] transition-colors hover:bg-[#F1F0FB]"
            >
              {link.label}
            </a>
          ))}
          <a
            href={ctaHref}
            onClick={() => setMobileOpen(false)}
            className="mt-2 rounded-full bg-[#E07A5F] px-5 py-2.5 text-center text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            {ctaLabel}
          </a>
        </div>
      )}
    </nav>
  );
}
