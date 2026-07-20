"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Marquee — a full-bleed, auto-scrolling strip of short keywords (напрямки,
 * цінності, переваги), framed by ferri's gold hairlines. The track holds the
 * list twice back-to-back so a linear -50% translate loops seamlessly; spacing
 * lives on each item (not a flex gap) so the two copies tile exactly. No global
 * keyframes — framer-motion (already used by Reveal) drives it and honours
 * prefers-reduced-motion by rendering the strip static and centred. Keywords
 * are serif, split by small gold diamonds; edge gradients fade the strip into
 * the navy page and flip with the light theme (both read from --color-navy-950).
 * Purely textual — no images, nothing else in the template scrolls like it.
 */
export default function FerriMarquee({ data }: { data: unknown }) {
  const d = data as BlockProps["marquee"];
  const reduce = useReducedMotion();

  const Item = ({ text }: { text: string }) => (
    <span className="flex flex-none items-center whitespace-nowrap">
      <span className="px-6 font-[family-name:var(--ferri-display)] text-xl font-light tracking-wide text-cream-200 sm:px-10 sm:text-2xl">
        {text}
      </span>
      <span className="h-1.5 w-1.5 flex-none rotate-45 bg-gold-500/60" aria-hidden="true" />
    </span>
  );

  return (
    <section className="relative overflow-hidden border-y border-gold-500/8 py-10 sm:py-14">
      {d.title && (
        <p className="mb-8 px-4 text-center text-xs uppercase tracking-[3px] text-gold-500">
          {d.title}
        </p>
      )}

      <div className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-navy-950 to-transparent sm:w-32"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-navy-950 to-transparent sm:w-32"
          aria-hidden="true"
        />

        {reduce ? (
          <div className="flex flex-wrap items-center justify-center px-6">
            {d.items.map((text, i) => (
              <Item key={i} text={text} />
            ))}
          </div>
        ) : (
          <motion.div
            className="flex w-max items-center"
            animate={{ x: ["0%", "-50%"] }}
            transition={{ duration: 28, ease: "linear", repeat: Infinity }}
            aria-hidden="true"
          >
            {[...d.items, ...d.items].map((text, i) => (
              <Item key={i} text={text} />
            ))}
          </motion.div>
        )}
      </div>
    </section>
  );
}
