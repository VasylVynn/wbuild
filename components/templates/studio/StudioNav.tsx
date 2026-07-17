"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

type NavLink = { href: string; label: string };

/*
 * Nav — verbatim port of the source Navigation: a fixed top bar that starts
 * transparent and condenses into a blurred dark bar once you scroll past
 * 50px, with a slide-in full-screen mobile menu (hamburger → X) below md.
 *
 * Parameterised: brand (name + muted accent word), nav links, and the CTA
 * label/href are all optional props with UA demo defaults so a generated site
 * can override them. next-intl (`t()`) and `siteConfig` are stripped.
 *
 * Fidelity deltas: the source's 5th link (`team`) is dropped — this port has
 * no Team section to point at. next/link swapped for plain <a> — every link
 * here (brand included) targets an in-page anchor or is a page-relative root,
 * not a Next.js route.
 */
export default function StudioNav({
  brandName = "Студія",
  brandAccent = "Про",
  logoUrl,
  navLinks = [
    { href: "#features", label: "Переваги" },
    { href: "#pricing", label: "Тарифи" },
    { href: "#about", label: "Про нас" },
    { href: "#faq", label: "Питання" },
  ],
  ctaLabel = "Залишити заявку",
  ctaHref = "#lead",
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
    <>
      <nav
        role="navigation"
        aria-label="Main navigation"
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-[#09090b]/90 backdrop-blur-md py-4 border-b border-white/5"
            : "bg-transparent py-5"
        }`}
      >
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between">
            <a href="/" className="flex items-center gap-2 text-xl font-semibold text-white tracking-tight">
              {logoUrl && <img src={logoUrl} alt="" className="h-8 w-auto max-w-[160px] shrink-0 object-contain" />}
              <span>
                {brandName}
                <span className="text-zinc-500 font-normal">{brandAccent}</span>
              </span>
            </a>

            <div className="hidden md:flex items-center gap-8">
              {navLinks.map((link) => (
                <a key={link.href} href={link.href} className="text-sm text-zinc-400 hover:text-white transition-colors">
                  {link.label}
                </a>
              ))}
              <a href={ctaHref} className="btn-gradient px-5 py-2.5 text-sm">
                {ctaLabel}
              </a>
            </div>

            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden w-10 h-10 flex flex-col items-center justify-center gap-1.5"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
            >
              <span className={`w-5 h-px bg-white transition-all duration-300 ${mobileOpen ? "rotate-45 translate-y-[4px]" : ""}`} />
              <span className={`w-5 h-px bg-white transition-all duration-300 ${mobileOpen ? "opacity-0" : ""}`} />
              <span className={`w-5 h-px bg-white transition-all duration-300 ${mobileOpen ? "-rotate-45 -translate-y-[4px]" : ""}`} />
            </button>
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-[#09090b] pt-20"
          >
            <div className="container mx-auto px-6">
              <div className="flex flex-col gap-6 pt-4">
                {navLinks.map((link, i) => (
                  <motion.a
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className="text-2xl font-medium text-white"
                  >
                    {link.label}
                  </motion.a>
                ))}
                <motion.a
                  href={ctaHref}
                  onClick={() => setMobileOpen(false)}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.35 }}
                  className="mt-4 btn-gradient text-center"
                >
                  {ctaLabel}
                </motion.a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
