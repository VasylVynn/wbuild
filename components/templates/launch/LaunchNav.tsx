"use client";

import { useState } from "react";

type NavLink = { href: string; label: string };

/*
 * Nav — CHROME (no block/schema — rendered by LaunchWrapper around every page).
 * Same prop signature as the other templates' navs ({ brandName?, brandAccent?,
 * logoUrl?, navLinks?, ctaHref? } — matching TemplateBrand, all the wrapper
 * passes) and the same mobile hamburger → dropdown-card behaviour. Restyled to
 * the Launch look: a sticky translucent bar with a blurred glass backdrop, brand
 * name truncated to one line (max-w), optional contained logo, and a contained
 * primary CTA. Colours read the scoped --launch-* vars so it flips with theme.
 */
export default function LaunchNav({
  brandName = "Launch",
  brandAccent = "",
  logoUrl,
  navLinks = [
    { href: "#services", label: "Послуги" },
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
      className="sticky top-0 z-50 border-b border-[var(--launch-border)] bg-[var(--launch-bg)]/70 backdrop-blur-lg"
    >
      <div className="mx-auto grid max-w-6xl grid-cols-2 items-center px-4 py-4 sm:px-6 md:grid-cols-3">
        <a href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight text-[var(--launch-fg)]" style={{ fontFamily: "var(--launch-display)" }}>
          {logoUrl && <img src={logoUrl} alt="" className="h-8 w-auto max-w-[150px] shrink-0 object-contain" />}
          <span className="truncate max-w-[200px] md:max-w-[300px]">
            {brandName}
            {brandAccent && <span className="text-[var(--launch-brand)]">{brandAccent}</span>}
          </span>
        </a>

        <div className="hidden items-center justify-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a key={link.href} href={link.href} className="text-sm font-medium text-[var(--launch-muted)] transition-colors hover:text-[var(--launch-fg)]">
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden justify-end md:flex">
          <a href={ctaHref} className="launch-btn launch-btn--primary !py-2 !text-sm">
            Залишити заявку
          </a>
        </div>

        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="justify-self-end text-[var(--launch-fg)] md:hidden"
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
        <div className="launch-glass mx-4 mb-4 flex flex-col gap-1 rounded-2xl p-4 md:hidden">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--launch-fg)] transition-colors hover:bg-[var(--launch-input)]"
            >
              {link.label}
            </a>
          ))}
          <a
            href={ctaHref}
            onClick={() => setMobileOpen(false)}
            className="launch-btn launch-btn--primary mt-2 !py-2.5 !text-sm"
          >
            Залишити заявку
          </a>
        </div>
      )}
    </nav>
  );
}
