"use client";

import { useState } from "react";

type NavLink = { href: string; label: string };

/*
 * Nav — CHROME (no block/schema — rendered by SparkWrapper around every page).
 * A sticky translucent bar with a hairline bottom border, a mono-uppercase
 * wordmark, quiet centre links and a solid primary CTA. Prop signature matches
 * TemplateBrand exactly (all SparkWrapper ever passes). Mobile hamburger →
 * dropdown card. Brand text is ONE truncated line; the CTA can never overflow.
 */
export default function SparkNav({
  brandName = "Spark",
  brandAccent = "Studio",
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
      className="sticky top-0 z-50 border-b border-[var(--spark-border)] bg-[var(--spark-bg)]/80 backdrop-blur"
    >
      <div className="mx-auto grid max-w-6xl grid-cols-2 items-center px-4 py-4 sm:px-6 md:grid-cols-3">
        <a href="/" className="flex min-w-0 items-center gap-2 text-[var(--spark-fg)]">
          {logoUrl && <img src={logoUrl} alt="" className="h-7 w-auto max-w-[140px] shrink-0 object-contain" />}
          <span className="spark-mono truncate max-w-[220px] text-[0.9375rem] font-medium tracking-tight md:max-w-[320px]">
            {brandName}
            <span className="text-[var(--spark-muted-fg)]">{brandAccent}</span>
          </span>
        </a>

        <div className="hidden items-center justify-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-[var(--spark-muted-fg)] transition-colors hover:text-[var(--spark-fg)]"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden justify-end md:flex">
          <a href={ctaHref} className="spark-btn spark-btn-primary truncate px-5 py-2 text-sm">
            Обговорити проєкт
          </a>
        </div>

        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="justify-self-end text-[var(--spark-fg)] md:hidden"
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
        <div className="mx-4 mb-4 flex flex-col gap-1 rounded-[var(--spark-radius)] border border-[var(--spark-border)] bg-[var(--spark-card)] p-4 shadow-[var(--spark-shadow)] md:hidden">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="rounded-[var(--spark-radius)] px-3 py-2.5 text-sm font-medium text-[var(--spark-fg)] transition-colors hover:bg-[var(--spark-muted)]"
            >
              {link.label}
            </a>
          ))}
          <a
            href={ctaHref}
            onClick={() => setMobileOpen(false)}
            className="spark-btn spark-btn-primary mt-2 w-full text-sm"
          >
            Обговорити проєкт
          </a>
        </div>
      )}
    </nav>
  );
}
