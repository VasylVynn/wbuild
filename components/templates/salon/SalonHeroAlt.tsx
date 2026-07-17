"use client";

import { motion } from "framer-motion";
import type { BlockProps } from "@/lib/blocks/schema";
import SalonAurora from "./SalonAurora";
import SalonOrganicShapes from "./SalonOrganicShapes";
import SalonParticles from "./SalonParticles";

/*
 * Hero (alt layout) — asymmetric split instead of the default's centred
 * full-viewport hero: eyebrow badge, gradient serif title, subtitle and CTAs
 * sit left-aligned in one column; a big rounded image card (or a gradient
 * blob when no `imageUrl`) fills the other, offset with a soft glow. Same
 * layered background animations and entrance motion as the default.
 */
export default function SalonHeroAlt({ data }: { data: unknown }) {
  const d = data as BlockProps["hero"];

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-background py-24">
      <div className="absolute inset-0 bg-gradient-to-br from-background via-muted/50 to-background dark:from-black dark:via-zinc-900 dark:to-zinc-950" />

      <SalonAurora />
      <SalonOrganicShapes />
      <SalonParticles />

      <div className="relative z-10 section-container grid lg:grid-cols-2 gap-16 items-center max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.3 }}
          className="space-y-8 text-center lg:text-left"
        >
          {d.eyebrow && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="inline-flex items-center gap-3 px-6 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-md shadow-elegant"
            >
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              <span className="text-accent font-medium text-xs md:text-sm uppercase tracking-[0.4em]">{d.eyebrow}</span>
            </motion.div>
          )}

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="font-display text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.05] tracking-tighter"
          >
            <span className="inline-block bg-gradient-to-tr from-foreground via-accent to-beauty-pink bg-clip-text text-transparent drop-shadow-sm">
              {d.title}
            </span>
          </motion.h1>

          {d.titleAccent && (
            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="text-2xl md:text-3xl font-light tracking-tight text-foreground/90 font-display"
            >
              <span className="text-gradient-gold italic">{d.titleAccent}</span>
            </motion.p>
          )}

          {d.subtitle && (
            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.7 }}
              className="text-lg md:text-xl max-w-md mx-auto lg:mx-0 text-muted-foreground/90 leading-relaxed font-light"
            >
              {d.subtitle}
            </motion.p>
          )}

          {(d.ctaLabel || d.secondaryCtaLabel) && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.8 }}
              className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-6 pt-2"
            >
              {d.ctaLabel && (
                <a
                  href={d.ctaHref ?? "#"}
                  className="btn-gold-luxe rounded-full px-10 py-4 font-medium text-lg min-w-[220px]"
                >
                  {d.ctaLabel}
                </a>
              )}
              {d.secondaryCtaLabel && (
                <a
                  href={d.secondaryCtaHref ?? "#"}
                  className="group flex items-center gap-3 text-foreground/80 hover:text-accent font-medium text-sm md:text-base uppercase tracking-[0.2em] transition-colors duration-300"
                >
                  {d.secondaryCtaLabel}
                  <motion.span className="inline-block" whileHover={{ x: 5 }} transition={{ duration: 0.3 }}>
                    →
                  </motion.span>
                </a>
              )}
            </motion.div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.5 }}
          className="relative mx-auto lg:mx-0 lg:ml-auto w-full max-w-md aspect-[4/5] lg:translate-y-8"
        >
          <div className="absolute -inset-8 bg-gradient-to-br from-accent/20 via-beauty-pink/10 to-transparent blur-[80px] rounded-full" />
          {d.imageUrl ? (
            <img
              src={d.imageUrl}
              alt={d.imageAlt ?? d.title}
              className="relative z-10 w-full h-full object-cover rounded-[3rem] shape-blob shadow-gold border border-white/10"
            />
          ) : (
            <div className="relative z-10 w-full h-full rounded-[3rem] shape-blob bg-gradient-to-br from-accent/30 via-beauty-pink/20 to-gold/20 border border-white/10 shadow-gold glass" />
          )}
        </motion.div>
      </div>
    </section>
  );
}
