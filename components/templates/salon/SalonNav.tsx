"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

type NavLink = { href: string; label: string };

const MenuIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-5 h-5" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
  </svg>
);
const XIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-5 h-5" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

/*
 * Nav — CHROME (no direct source equivalent as a standalone port; adapted
 * from the salon source Navbar's floating pill idea). A sticky glass PILL,
 * centered and inset from the top, serif brand with a gold-gradient accent
 * word, anchor links, and a btn-gold-luxe CTA. Below md the links/CTA
 * collapse behind a hamburger that opens a glass-card dropdown panel.
 *
 * Parameterised: brand (name + accent word), nav links, and CTA label/href
 * are optional props with UA demo defaults. next/link swapped for plain
 * <a> — every link is an in-page anchor. No theme toggle here — the
 * SalonWrapper owns light/dark switching.
 */
export default function SalonNav({
  brandName = "LUXE",
  brandAccent = "Салон",
  navLinks = [
    { href: "#services", label: "Послуги" },
    { href: "#gallery", label: "Галерея" },
    { href: "#testimonials", label: "Відгуки" },
    { href: "#faq", label: "Питання" },
  ],
  ctaLabel = "Записатися",
  ctaHref = "#lead",
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
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <motion.nav
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        role="navigation"
        aria-label="Main navigation"
        className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-4xl rounded-full transition-all duration-500 ${
          scrolled ? "liquid-glass shadow-elegant" : "glass"
        }`}
      >
        <div className="flex items-center justify-between px-6 py-3">
          <a href="#" className="font-display text-xl font-bold text-foreground tracking-tight">
            {brandName} <span className="text-gradient-gold">{brandAccent}</span>
          </a>

          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-full hover:bg-accent/10 transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <a href={ctaHref} className="hidden md:inline-flex btn-gold-luxe rounded-full px-6 py-2.5 text-sm font-medium">
              {ctaLabel}
            </a>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden w-10 h-10 flex items-center justify-center rounded-full text-foreground hover:bg-accent/10 transition-colors"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <XIcon /> : <MenuIcon />}
            </button>
          </div>
        </div>
      </motion.nav>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.96 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-40 w-[95%] max-w-4xl glass-card rounded-3xl p-6 md:hidden"
          >
            <div className="flex flex-col gap-1">
              {navLinks.map((link, i) => (
                <motion.a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="px-4 py-3 text-base font-medium text-foreground rounded-2xl hover:bg-accent/10 transition-colors"
                >
                  {link.label}
                </motion.a>
              ))}
              <motion.a
                href={ctaHref}
                onClick={() => setMobileOpen(false)}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: navLinks.length * 0.06 }}
                className="mt-3 btn-gold-luxe rounded-full py-3 text-sm font-medium text-center"
              >
                {ctaLabel}
              </motion.a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
