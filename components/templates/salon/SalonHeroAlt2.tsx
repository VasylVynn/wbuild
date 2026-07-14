"use client";

import { motion } from "framer-motion";
import type { BlockProps } from "@/lib/blocks/schema";
import { ScrollReveal } from "./ScrollReveal";

/*
 * SalonHeroAlt2 — alternate hero: an editorial-magazine split instead of the
 * default's centred full-viewport hero with layered background animations.
 * A tall rounded image (or a gradient stand-in when there's no `imageUrl`)
 * fills most of the section on one side; a glass text card overlaps it from
 * the other side, carrying eyebrow, gradient serif title + accent, subtitle
 * and CTAs — airier and more asymmetric than the default.
 */
export default function SalonHeroAlt2({ data }: { data: unknown }) {
  const d = data as BlockProps["hero"];

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-background py-24">
      <div className="absolute inset-0 bg-gradient-to-br from-background via-muted/30 to-background dark:from-black dark:via-zinc-900 dark:to-zinc-950" />

      <div className="relative z-10 section-container">
        <div className="grid lg:grid-cols-12 gap-6 lg:gap-0 items-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="lg:col-span-7 relative rounded-[2.5rem] overflow-hidden h-[60vh] lg:h-[78vh] shadow-elegant"
          >
            {d.imageUrl ? (
              <img src={d.imageUrl} alt={d.title} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-gradient-to-tr from-accent via-beauty-pink to-gold-light" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-background/40 via-transparent to-transparent dark:from-black/50" />
          </motion.div>

          <div className="lg:col-span-6 lg:-ml-24 relative z-10">
            <ScrollReveal direction="right">
              <div className="glass-card p-8 sm:p-12">
                {d.eyebrow && <span className="section-tag">{d.eyebrow}</span>}

                <h1 className="font-display text-gradient-primary mt-2 text-4xl font-bold leading-[1.05] sm:text-5xl lg:text-6xl">
                  {d.title}
                </h1>

                {d.titleAccent && (
                  <p className="text-gradient-gold mt-2 text-2xl font-light italic sm:text-3xl">{d.titleAccent}</p>
                )}

                {d.subtitle && (
                  <p className="text-muted-foreground mt-6 text-lg font-light leading-relaxed">{d.subtitle}</p>
                )}

                {(d.ctaLabel || d.secondaryCtaLabel) && (
                  <div className="mt-8 flex flex-col sm:flex-row gap-4">
                    {d.ctaLabel && (
                      <a
                        href={d.ctaHref ?? "#"}
                        className="btn-gold-luxe rounded-full px-10 py-4 text-center font-medium"
                      >
                        {d.ctaLabel}
                      </a>
                    )}
                    {d.secondaryCtaLabel && (
                      <a
                        href={d.secondaryCtaHref ?? "#"}
                        className="group flex items-center justify-center gap-2 text-foreground/80 hover:text-accent font-medium text-sm uppercase tracking-[0.2em] transition-colors duration-300"
                      >
                        {d.secondaryCtaLabel}
                        <motion.span className="inline-block" whileHover={{ x: 5 }} transition={{ duration: 0.3 }}>
                          →
                        </motion.span>
                      </a>
                    )}
                  </div>
                )}
              </div>
            </ScrollReveal>
          </div>
        </div>
      </div>
    </section>
  );
}
