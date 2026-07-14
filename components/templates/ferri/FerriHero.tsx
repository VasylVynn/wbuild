"use client";

import { motion } from "framer-motion";
import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Hero — verbatim port of the source ferri hero: full-viewport-ish split
 * layout with a decorative vertical gold line, two low-opacity radial
 * gradient overlays, and staggered entrance motion. The source's built-in
 * stats row and photo name-tag are dropped — stats render as their own
 * `FerriStats` section, and the name tag has no matching schema field.
 *
 * Parameterised: eyebrow, title (+ optional italic gold `titleAccent` on its
 * own line), subtitle, two CTAs (ctaLabel gold-filled / secondaryCtaLabel
 * gold-outline, both defaulting href to "#"), and an optional imageUrl —
 * when absent, the text column spans the full width.
 */
export default function FerriHero({ data }: { data: unknown }) {
  const d = data as BlockProps["hero"];

  return (
    <section className="relative flex min-h-screen items-center overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(184,150,90,0.04)_0%,_transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_rgba(17,40,64,0.5)_0%,_transparent_60%)]" />

      <motion.div
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ duration: 1.2, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="absolute left-4 top-0 h-full w-px origin-top bg-gradient-to-b from-transparent via-gold-500/20 to-transparent sm:left-8 lg:left-16"
      />

      <div className="relative mx-auto w-full max-w-7xl px-4 pb-16 pt-36 sm:px-6 lg:px-8 lg:pb-20 lg:pt-44">
        <div className={`grid items-end gap-10 ${d.imageUrl ? "lg:grid-cols-2 lg:gap-16" : ""}`}>
          <div>
            {d.eyebrow && (
              <motion.p
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="mb-5 flex items-center gap-3 text-xs font-medium uppercase tracking-[3px] text-gold-500 sm:mb-6"
              >
                <span className="h-px w-8 bg-gold-500" />
                {d.eyebrow}
              </motion.p>
            )}

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="font-[family-name:var(--font-cormorant)] text-4xl font-light leading-[1.1] text-cream-100 sm:text-5xl md:text-6xl lg:text-7xl"
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
                transition={{ duration: 0.7, delay: 0.5 }}
                className="mt-6 max-w-xl text-base leading-relaxed text-txt-muted sm:mt-8"
              >
                {d.subtitle}
              </motion.p>
            )}

            {(d.ctaLabel || d.secondaryCtaLabel) && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.7 }}
                className="mt-8 flex flex-wrap gap-3 sm:mt-10 sm:gap-4"
              >
                {d.ctaLabel && (
                  <a
                    href={d.ctaHref ?? "#"}
                    className="group inline-flex items-center gap-2 bg-gold-500 px-6 py-3 text-[13px] font-medium uppercase tracking-[2px] text-navy-950 transition-all duration-300 hover:bg-gold-400 sm:px-8 sm:py-3.5"
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
                    className="inline-flex items-center gap-2 border border-gold-500/40 px-6 py-3 text-[13px] font-medium uppercase tracking-[2px] text-gold-500 transition-all duration-300 hover:border-gold-500 hover:bg-gold-500/5 sm:px-8 sm:py-3.5"
                  >
                    {d.secondaryCtaLabel}
                  </a>
                )}
              </motion.div>
            )}
          </div>

          {d.imageUrl && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="relative mx-auto hidden w-full max-w-xs lg:block"
            >
              <div className="absolute -left-3 -top-3 h-16 w-16 border-l border-t border-gold-500/30" />
              <div className="absolute -bottom-3 -right-3 h-16 w-16 border-b border-r border-gold-500/30" />

              <div className="relative overflow-hidden" style={{ maxHeight: "420px" }}>
                <img
                  src={d.imageUrl}
                  alt={d.title}
                  className="h-auto w-full object-cover object-top grayscale-[20%] transition-all duration-700 hover:grayscale-0"
                />
                <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-navy-950/80 to-transparent" />
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </section>
  );
}
