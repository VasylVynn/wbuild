"use client";

import { useState, useEffect } from "react";

type NavLink = { href: string; label: string };

/*
 * Nav — chrome, not a block. Fixed header, transparent at the top and
 * condensing into a blurred navy bar with a gold hairline once scrolled past
 * 32px (mirrors template_sources/ferri-schoedl-main/src/components/Navbar.tsx).
 * Text-only serif brand (no logo image); desktop anchor links plus a
 * gold-outline CTA; mobile hamburger opens a dropdown menu. next/link,
 * next/image, lucide, and the source's dropdown/cart/user-menu machinery are
 * all stripped — every link here is a page-relative anchor.
 */
export default function FerriNav({
  brandName = "Студія",
  brandAccent = "Право",
  logoUrl,
  navLinks = [
    { href: "#services", label: "Напрямки" },
    { href: "#about", label: "Про нас" },
    { href: "#testimonials", label: "Відгуки" },
    { href: "#faq", label: "Питання" },
  ],
  ctaLabel = "Контакти",
  ctaHref = "#contacts",
}: {
  brandName?: string;
  brandAccent?: string;
  logoUrl?: string;
  navLinks?: NavLink[];
  ctaLabel?: string;
  ctaHref?: string;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 32);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed left-0 right-0 top-0 z-50 transition-all duration-500 ${
        scrolled ? "border-b border-gold-500/10 bg-navy-950/95 backdrop-blur-md" : "bg-transparent"
      }`}
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <a href="/" className="flex items-center gap-2 font-[family-name:var(--ferri-display)] text-2xl tracking-wide text-cream-100">
          {logoUrl && <img src={logoUrl} alt="" className="h-8 w-auto max-w-[160px] shrink-0 object-contain" />}
          <span>
            {brandName} <span className="text-gold-500">{brandAccent}</span>
          </span>
        </a>

        {/* Desktop links */}
        <div className="hidden items-center gap-8 lg:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm tracking-wide text-txt-muted transition-colors hover:text-cream-100"
            >
              {link.label}
            </a>
          ))}
          <a
            href={ctaHref}
            className="border border-gold-500/50 px-5 py-2 text-xs font-medium uppercase tracking-[2px] text-gold-500 transition-all duration-300 hover:border-gold-500 hover:bg-gold-500 hover:text-navy-950"
          >
            {ctaLabel}
          </a>
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="flex h-10 w-10 items-center justify-center text-cream-100 lg:hidden"
          aria-label={mobileOpen ? "Закрити меню" : "Відкрити меню"}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </nav>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="border-t border-gold-500/10 bg-navy-950/98 backdrop-blur-md lg:hidden">
          <div className="flex flex-col px-4 py-4 sm:px-6">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="border-b border-gold-500/5 py-3.5 text-sm tracking-wide text-txt-muted"
              >
                {link.label}
              </a>
            ))}
            <a
              href={ctaHref}
              onClick={() => setMobileOpen(false)}
              className="mt-4 border border-gold-500/50 py-3 text-center text-xs font-medium uppercase tracking-[2px] text-gold-500"
            >
              {ctaLabel}
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
