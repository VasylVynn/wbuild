"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import type { BlockProps } from "@/lib/blocks/schema";

type HeroStat = { value: string; label: string };

/*
 * Hero — verbatim port of the source HeroSection: full-viewport centred hero
 * with two drifting gradient blobs, a scroll parallax (content fades + lifts
 * as you scroll past), an eyebrow badge, headline, subline and up to two CTAs.
 *
 * Parameterised: badge=eyebrow, headline=title, subline=subtitle, the two CTAs
 * from ctaLabel/secondaryCtaLabel (+ hrefs). The 3-stat row is fed by the
 * optional `extra` prop (stats items) and only renders when provided.
 *
 * Fidelity deltas: the source split the headline into a plain + violet
 * `.gradient-text` span — we render the single `title` string plain; the
 * source's secondary CTA carried a messenger glyph — dropped (vertical-neutral).
 * The infinite blob drift is gated on prefers-reduced-motion.
 */
export default function HeroSection({ data, extra }: { data: unknown; extra?: unknown }) {
  const d = data as BlockProps["hero"];
  const stats = (extra as HeroStat[] | undefined) ?? undefined;
  const reduce = useReducedMotion();

  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const contentOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);
  const contentY = useTransform(scrollYProgress, [0, 0.6], [0, -80]);

  const primaryHref = d.ctaHref ?? "#";
  const secondaryHref = d.secondaryCtaHref ?? "#";

  return (
    <section ref={heroRef} className="saas-hero">
      <motion.div className="saas-hero__mesh" aria-hidden="true">
        <div className="absolute inset-0">
          <motion.div
            className="absolute w-[500px] h-[500px] rounded-full blur-[160px] opacity-[0.07]"
            style={{ background: "radial-gradient(circle, #8B5CF6 0%, transparent 70%)" }}
            animate={reduce ? undefined : { x: ["-10%", "10%", "-10%"], y: ["-5%", "5%", "-5%"] }}
            transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
            initial={{ top: "20%", left: "30%" }}
          />
          <motion.div
            className="absolute w-[400px] h-[400px] rounded-full blur-[140px] opacity-[0.04]"
            style={{ background: "radial-gradient(circle, #7C3AED 0%, transparent 70%)" }}
            animate={reduce ? undefined : { x: ["5%", "-5%", "5%"], y: ["8%", "-8%", "8%"] }}
            transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
            initial={{ bottom: "20%", right: "20%" }}
          />
        </div>
        <div className="saas-hero__overlay" />
      </motion.div>

      <motion.div className="saas-hero__content pt-20" style={{ opacity: contentOpacity, y: contentY }}>
        {d.eyebrow && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-white/10 bg-white/[0.03] mb-8"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] opacity-70" />
            <span className="text-xs font-medium text-zinc-400">{d.eyebrow}</span>
          </motion.div>
        )}

        <motion.h1
          className="saas-hero__headline"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.8, ease: [0.76, 0, 0.24, 1] }}
        >
          {d.title}
        </motion.h1>

        {d.subtitle && (
          <motion.p
            className="saas-hero__subline"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
          >
            {d.subtitle}
          </motion.p>
        )}

        {(d.ctaLabel || d.secondaryCtaLabel) && (
          <motion.div
            className="flex flex-col sm:flex-row gap-3 justify-center items-center mb-14"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.6 }}
          >
            {d.ctaLabel && (
              <a href={primaryHref} className="btn-gradient">
                {d.ctaLabel}
                <svg className="ml-2 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </a>
            )}
            {d.secondaryCtaLabel && (
              <a href={secondaryHref} className="btn-ghost">
                {d.secondaryCtaLabel}
              </a>
            )}
          </motion.div>
        )}

        {stats && stats.length > 0 && (
          <motion.div
            className="flex gap-12 md:gap-16 justify-center flex-wrap"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9, duration: 0.8 }}
          >
            {stats.map((stat, i) => (
              <div key={i} className="text-center">
                <span className="block text-2xl md:text-3xl font-semibold text-white tabular-nums">{stat.value}</span>
                <span className="block text-xs uppercase tracking-widest text-zinc-500 mt-1">{stat.label}</span>
              </div>
            ))}
          </motion.div>
        )}
      </motion.div>
    </section>
  );
}
