"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Marquee — a full-bleed strip of short keywords that glides horizontally in a
 * seamless loop, hair-lined top and bottom. Unlike the studio's card grids it
 * spans the viewport, never wraps, and its edges fade into the page so the loop
 * reads as endless. Each keyword is trailed by a small accent dot separator.
 *
 * Fed by our `marquee` block (array of short strings + optional title). Motion
 * uses framer (already a template dep via Reveal): two identical groups scroll
 * -50%, which is exactly one group's width, so the wrap is invisible. Reduced-
 * motion users get a centred, static, wrapped row instead of the scroll.
 */
function MarqueeItem({ label }: { label: string }) {
  return (
    <span className="flex items-center gap-6 md:gap-10 shrink-0">
      <span className="text-lg md:text-2xl font-medium tracking-tight text-zinc-400 whitespace-nowrap">
        {label}
      </span>
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)] opacity-70" />
    </span>
  );
}

export default function StudioMarquee({ data }: { data: unknown }) {
  const d = data as BlockProps["marquee"];
  const reduce = useReducedMotion();

  // Speed scales with the keyword count so the strip glides at a steady pace
  // no matter how many the model produced.
  const duration = Math.max(18, d.items.length * 4);

  return (
    <section
      className="py-8 md:py-10 border-y border-white/10 overflow-hidden"
      aria-label={d.title || "Ключові напрями"}
    >
      {reduce ? (
        <div className="container mx-auto px-4 sm:px-6 flex flex-wrap justify-center gap-x-8 gap-y-3">
          {d.items.map((label, i) => (
            <MarqueeItem key={i} label={label} />
          ))}
        </div>
      ) : (
        <div
          className="relative flex"
          style={{
            maskImage: "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
            WebkitMaskImage: "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
          }}
        >
          <motion.div
            className="flex"
            animate={{ x: ["0%", "-50%"] }}
            transition={{ duration, ease: "linear", repeat: Infinity }}
          >
            {[0, 1].map((copy) => (
              <div key={copy} className="flex gap-6 md:gap-10 pr-6 md:pr-10" aria-hidden={copy === 1}>
                {d.items.map((label, i) => (
                  <MarqueeItem key={i} label={label} />
                ))}
              </div>
            ))}
          </motion.div>
        </div>
      )}
    </section>
  );
}
