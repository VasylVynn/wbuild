"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Hero (alt layout 2) — minimal: where the default is a centred hero with a
 * badge eyebrow, two CTAs and a stat row, and Alt is a left/right split with
 * a decorative panel, this strips everything down to a tiny label, one huge
 * fluid headline and a single CTA, floating in a narrow column with a lot of
 * empty space around it. Only one faint blob drifts behind it (vs. the
 * default/Alt's two), gated on prefers-reduced-motion like the others.
 */
export default function StudioHeroAlt2({ data }: { data: unknown }) {
  const d = data as BlockProps["hero"];
  const reduce = useReducedMotion();

  const primaryHref = d.ctaHref ?? "#";

  return (
    <section className="saas-hero">
      <motion.div className="saas-hero__mesh" aria-hidden="true">
        <div className="absolute inset-0">
          <motion.div
            className="absolute w-[600px] h-[600px] rounded-full blur-[180px] opacity-[0.05]"
            style={{ background: "radial-gradient(circle, #8B5CF6 0%, transparent 70%)" }}
            animate={reduce ? undefined : { x: ["-8%", "8%", "-8%"], y: ["-6%", "6%", "-6%"] }}
            transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
            initial={{ top: "35%", left: "35%" }}
          />
        </div>
        <div className="saas-hero__overlay" />
      </motion.div>

      <div className="relative z-[3] w-full max-w-3xl mx-auto px-6 py-32 text-center">
        {d.eyebrow && (
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-xs font-medium uppercase tracking-[0.3em] text-zinc-500 mb-6"
          >
            {d.eyebrow}
          </motion.p>
        )}

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.9, ease: [0.76, 0, 0.24, 1] }}
          className="text-[clamp(2.75rem,9vw,7.5rem)] font-bold leading-[0.95] tracking-[-0.04em] text-white"
        >
          {d.title}
          {d.titleAccent && (
            <>
              <br />
              <span className="gradient-text">{d.titleAccent}</span>
            </>
          )}
        </motion.h1>

        {d.subtitle && (
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="mt-8 text-base text-zinc-500 max-w-md mx-auto"
          >
            {d.subtitle}
          </motion.p>
        )}

        {d.ctaLabel && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="mt-14"
          >
            <a href={primaryHref} className="btn-gradient">
              {d.ctaLabel}
            </a>
          </motion.div>
        )}
      </div>
    </section>
  );
}
