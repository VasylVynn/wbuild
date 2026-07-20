"use client";

import { motion } from "framer-motion";
import type { BlockProps } from "@/lib/blocks/schema";

/*
 * FerriHeroAlt2 — second alternate hero: full-bleed background instead of
 * the default's left-aligned split-with-portrait or Alt's bare centred
 * editorial page. `d.imageUrl` fills the whole section behind a navy-to-gold
 * overlay for legibility; without an image a rich navy gradient stands in.
 * Copy (eyebrow, serif title + italic gold titleAccent, subtitle, CTAs) sits
 * centred on top, same entrance motion rhythm as the other two heroes.
 */
export default function FerriHeroAlt2({ data }: { data: unknown }) {
  const d = data as BlockProps["hero"];

  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden">
      <div className="absolute inset-0">
        {d.imageUrl ? (
          <img src={d.imageUrl} alt={d.imageAlt ?? d.title} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-navy-900 via-navy-950 to-navy-800" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/80 to-navy-950/30" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(184,150,90,0.12)_0%,_transparent_65%)]" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-4xl px-4 py-32 text-center sm:px-6 lg:px-8">
        {d.eyebrow && (
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mb-6 flex items-center justify-center gap-4 text-xs font-medium uppercase tracking-[3px] text-gold-400 sm:mb-8"
          >
            <span className="h-px w-10 bg-gold-500/60" />
            {d.eyebrow}
            <span className="h-px w-10 bg-gold-500/60" />
          </motion.p>
        )}

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="font-[family-name:var(--ferri-display)] text-5xl font-light leading-[1.05] text-cream-100 drop-shadow-lg sm:text-6xl md:text-7xl"
        >
          {d.title}
          {d.titleAccent && (
            <>
              <br />
              <em className="font-normal italic text-gold-400">{d.titleAccent}</em>
            </>
          )}
        </motion.h1>

        {d.subtitle && (
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.55 }}
            className="mx-auto mt-8 max-w-xl text-base leading-relaxed text-cream-200/90"
          >
            {d.subtitle}
          </motion.p>
        )}

        {(d.ctaLabel || d.secondaryCtaLabel) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.75 }}
            className="mt-10 flex flex-wrap items-center justify-center gap-4 sm:mt-12"
          >
            {d.ctaLabel && (
              <a
                href={d.ctaHref ?? "#"}
                className="group inline-flex items-center gap-2 bg-gold-500 px-8 py-3.5 text-[13px] font-medium uppercase tracking-[2px] text-navy-950 transition-all duration-300 hover:bg-gold-400"
              >
                {d.ctaLabel}
                <svg
                  className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </a>
            )}
            {d.secondaryCtaLabel && (
              <a
                href={d.secondaryCtaHref ?? "#"}
                className="inline-flex items-center gap-2 border border-gold-400/60 px-8 py-3.5 text-[13px] font-medium uppercase tracking-[2px] text-gold-300 backdrop-blur-sm transition-all duration-300 hover:border-gold-400 hover:bg-white/5"
              >
                {d.secondaryCtaLabel}
              </a>
            )}
          </motion.div>
        )}
      </div>
    </section>
  );
}
