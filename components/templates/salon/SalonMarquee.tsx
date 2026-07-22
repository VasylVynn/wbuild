"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Marquee — a full-width band that glides a single line of short keywords past
 * the viewer, each parted by a gold diamond. The row is duplicated so the loop
 * is seamless (translate -50%), with the edges dissolving under a soft mask.
 * Reduced-motion users get a static centred, wrapping row instead. Purely
 * typographic — no imagery — so it reads as a rhythmic breather between the
 * heavier sections rather than echoing any of them.
 */
export default function SalonMarquee({ data }: { data: unknown }) {
  const d = data as BlockProps["marquee"];
  const reduce = useReducedMotion();

  const Diamond = () => (
    <span
      aria-hidden="true"
      className="mx-8 sm:mx-12 inline-block h-2 w-2 shrink-0 rotate-45 bg-gradient-to-br from-accent to-beauty-pink"
    />
  );

  const Word = ({ text }: { text: string }) => (
    <span className="font-display text-2xl sm:text-3xl md:text-4xl font-semibold whitespace-nowrap text-foreground/80 dark:text-white/80">
      {text}
    </span>
  );

  return (
    <section className="py-14 sm:py-16 lg:py-20 bg-background dark:bg-black relative overflow-hidden transition-colors duration-1000">
      {d.title && <p className="section-tag text-center mb-8">{d.title}</p>}

      {/* Accessible plain list — the visible strip is decorative/duplicated. */}
      <ul className="sr-only">
        {d.items.map((text, i) => (
          <li key={i}>{text}</li>
        ))}
      </ul>

      {reduce ? (
        <div className="section-container flex flex-wrap items-center justify-center gap-y-4">
          {d.items.map((text, i) => (
            <span key={i} className="flex items-center">
              <Word text={text} />
              {i < d.items.length - 1 && <Diamond />}
            </span>
          ))}
        </div>
      ) : (
        <div
          aria-hidden="true"
          className="relative flex overflow-hidden"
          style={{
            maskImage:
              "linear-gradient(to right, transparent, black 12%, black 88%, transparent)",
            WebkitMaskImage:
              "linear-gradient(to right, transparent, black 12%, black 88%, transparent)",
          }}
        >
          <motion.div
            className="flex shrink-0 items-center py-2"
            animate={{ x: ["0%", "-50%"] }}
            transition={{
              duration: Math.max(18, d.items.length * 3),
              ease: "linear",
              repeat: Infinity,
            }}
          >
            {[...d.items, ...d.items].map((text, i) => (
              <span key={i} className="flex items-center">
                <Word text={text} />
                <Diamond />
              </span>
            ))}
          </motion.div>
        </div>
      )}
    </section>
  );
}
