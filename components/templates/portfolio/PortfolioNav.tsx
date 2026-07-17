"use client";

import { useEffect, useState } from "react";

type NavLink = { href: string; label: string };

const defaultNavLinks: NavLink[] = [
  { href: "#services", label: "Послуги" },
  { href: "#gallery", label: "Роботи" },
  { href: "#testimonials", label: "Відгуки" },
  { href: "#faq", label: "Питання" },
];

/*
 * Nav (CHROME) — port of the source Navbar: a fixed top bar that starts
 * transparent and condenses into a blurred `glass-strong` bar once you scroll
 * past 50px, with a pill of nav links and a solid CTA on desktop, collapsing
 * into a hamburger → glass-strong dropdown below md.
 *
 * Fidelity deltas: source `Button`/lucide icons dropped for a plain pill CTA
 * and inline Menu/X SVGs; next/link swapped for plain <a> — every link here
 * targets an in-page anchor.
 */
export default function PortfolioNav({
  brandName = "Portfolio",
  brandAccent = ".",
  logoUrl,
  navLinks = defaultNavLinks,
  ctaLabel = "Звʼязатися",
  ctaHref = "#lead_form",
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
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled ? "glass-strong py-3" : "bg-transparent py-5"
      }`}
    >
      <nav className="container mx-auto px-4 sm:px-6 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2 text-xl font-bold tracking-tight hover:text-primary transition-colors">
          {logoUrl && <img src={logoUrl} alt="" className="h-8 w-auto max-w-[160px] shrink-0 object-contain" />}
          <span>
            {brandName}
            <span className="text-primary">{brandAccent}</span>
          </span>
        </a>

        <div className="hidden md:flex items-center gap-4">
          <div className="glass rounded-full px-2 py-1 flex items-center gap-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground rounded-full hover:bg-surface transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>
          <a
            href={ctaHref}
            className="rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 px-5 py-2.5 text-sm font-medium"
          >
            {ctaLabel}
          </a>
        </div>

        <button
          onClick={() => setMobileOpen((prev) => !prev)}
          className="md:hidden p-2 text-foreground"
          aria-label={mobileOpen ? "Закрити меню" : "Відкрити меню"}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <XIcon /> : <MenuIcon />}
        </button>
      </nav>

      {mobileOpen && (
        <div className="md:hidden glass-strong animate-fade-in">
          <div className="container mx-auto px-4 sm:px-6 py-6 flex flex-col gap-4">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="text-lg text-muted-foreground hover:text-foreground py-2"
              >
                {link.label}
              </a>
            ))}
            <a
              href={ctaHref}
              onClick={() => setMobileOpen(false)}
              className="mt-2 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 px-5 py-3 text-sm font-medium text-center"
            >
              {ctaLabel}
            </a>
          </div>
        </div>
      )}
    </header>
  );
}

function MenuIcon() {
  return (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}
