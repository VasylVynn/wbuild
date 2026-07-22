"use client";

import { motion } from "framer-motion";
import type { BlockProps } from "@/lib/blocks/schema";

/*
 * FerriHeroAlt — alternate layout for the ferri hero. Where the default is a
 * left-aligned split with a portrait, this is a centered editorial hero: no
 * image, an eyebrow flanked by gold lines on both sides, a very large
 * centered serif title (+ italic gold titleAccent), centered subtitle, and
 * two centered CTAs. Thin gold frame lines mark the top and bottom of the
 * section for an editorial-page feel.
 */
export default function FerriHeroAlt({ data }: { data: unknown }) {
  const d = data as BlockProps["hero"];

  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(184,150,90,0.05)_0%,_transparent_65%)]" />

      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 1, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="absolute top-24 left-1/2 h-px w-40 origin-center -translate-x-1/2 bg-gold-500/30 sm:w-64"
      />
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 1, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="absolute bottom-24 left-1/2 h-px w-40 origin-center -translate-x-1/2 bg-gold-500/30 sm:w-64"
      />

      <div className="relative mx-auto w-full max-w-4xl px-4 py-32 text-center sm:px-6 lg:px-8">
        {d.eyebrow && (
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mb-6 flex items-center justify-center gap-4 text-xs font-medium uppercase tracking-[3px] text-gold-500 sm:mb-8"
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
          className="font-[family-name:var(--ferri-display)] text-5xl font-light leading-[1.05] text-cream-100 sm:text-6xl md:text-7xl lg:text-8xl"
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
            className="mx-auto mt-8 max-w-xl text-base leading-relaxed text-txt-muted sm:mt-10"
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
                className="inline-flex items-center gap-2 border border-gold-500/40 px-8 py-3.5 text-[13px] font-medium uppercase tracking-[2px] text-gold-500 transition-all duration-300 hover:border-gold-500 hover:bg-gold-500/5"
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
