"use client";

import { useState } from "react";

type NavLink = { href: string; label: string };

/*
 * Nav — CHROME (no block/schema — rendered by BelezaWrapper around every page).
 * Mirrors the source header: a sticky translucent bar with a rose logo mark, a
 * one-line truncated brand, quiet nav links and a contained rose CTA. Same prop
 * signature as the other templates' navs ({ brandName?, brandAccent?, logoUrl?,
 * navLinks?, ctaHref? } — matching TemplateBrand, which is all the wrapper ever
 * passes) with the same mobile hamburger → dropdown-card behaviour.
 */
export default function BelezaNav({
  brandName = "Белеза",
  brandAccent = "",
  logoUrl,
  navLinks = [
    { href: "#services", label: "Послуги" },
    { href: "#timeline", label: "Як проходить візит" },
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
      aria-label="Головна навігація"
      className="sticky top-0 z-50 border-b"
      style={{
        borderColor: "var(--beleza-border-subtle)",
        background: "color-mix(in srgb, var(--beleza-bg) 88%, transparent)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div className="beleza-container flex items-center justify-between gap-3 py-3.5">
        <a href="/" aria-label={brandName} className="inline-flex min-w-0 shrink items-center gap-2">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-8 w-auto max-w-[150px] shrink-0 object-contain" />
          ) : (
            <span className="beleza-chip !h-8 !w-8 !rounded-lg" aria-hidden="true">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c1.6 3 1.6 6 0 9m0 0c-1.6 3-1.6 6 0 9m0-9c3-1.6 6-1.6 9 0m-18 0c3-1.6 6-1.6 9 0" />
              </svg>
            </span>
          )}
          <span className="beleza-ink truncate text-base font-bold tracking-tight" style={{ fontFamily: "var(--beleza-display)" }}>
            {brandName}
            {brandAccent && <span className="beleza-accent">{brandAccent}</span>}
          </span>
        </a>

        <div className="hidden items-center gap-6 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href + link.label}
              href={link.href}
              className="beleza-muted whitespace-nowrap text-sm font-medium transition-colors hover:text-[color:var(--beleza-branding)]"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <a href={ctaHref} className="beleza-btn hidden !px-5 !py-2.5 !text-sm sm:inline-flex">
            Записатися
          </a>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="beleza-ink md:hidden"
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
      </div>

      {mobileOpen && (
        <div
          className="mx-4 mb-4 flex flex-col gap-1 rounded-3xl border bg-white p-4 shadow-lg md:hidden"
          style={{ borderColor: "var(--beleza-border-subtle)" }}
        >
          {navLinks.map((link) => (
            <a
              key={link.href + link.label}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="beleza-ink rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors hover:bg-[var(--beleza-brand-1)]"
            >
              {link.label}
            </a>
          ))}
          <a href={ctaHref} onClick={() => setMobileOpen(false)} className="beleza-btn beleza-btn--block mt-2 !py-2.5 !text-sm">
            Записатися
          </a>
        </div>
      )}
    </nav>
  );
}
