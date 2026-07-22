"use client";

import { motion } from "framer-motion";
import type { BlockProps } from "@/lib/blocks/schema";
import { ScrollReveal } from "./ScrollReveal";
import { useRevealGate } from "../shared/reveal";

/*
 * Stats — port of the source `about.tsx` "Enhanced Stats Section": a
 * glass-card band holding a 2/4-col grid of big gradient-gold numbers over
 * uppercase muted labels, each fading up with a slight stagger.
 */
export default function SalonStats({ data }: { data: unknown }) {
  const d = data as BlockProps["stats"];
  // H5 gate: the per-stat fade-up arms only below the fold after hydration —
  // SSR markup stays fully visible (hover scale is kept in both states).
  const [gridRef, armed] = useRevealGate<HTMLDivElement>();

  return (
    <section className="py-16 sm:py-20 lg:py-24">
      <div className="section-container">
        {d.title && (
          <h2 className="font-display section-title text-center">{d.title}</h2>
        )}

        <ScrollReveal>
          <div className="glass-card p-10 sm:p-12 md:p-16">
            <div ref={gridRef} className="grid grid-cols-2 gap-8 md:grid-cols-4 md:gap-12">
              {d.items.map((stat, i) => (
                <motion.div
                  key={i}
                  {...(armed
                    ? {
                        initial: { opacity: 0, y: 20 },
                        whileInView: { opacity: 1, y: 0 },
                        viewport: { once: true },
                        transition: { delay: i * 0.1 },
                      }
                    : {})}
                  whileHover={{ scale: 1.05 }}
                  className="group cursor-default text-center"
                >
                  <div className="font-display text-gradient-gold mb-3 text-5xl font-bold md:text-6xl lg:text-7xl">
                    {stat.value}
                  </div>
                  <p className="text-muted-foreground text-sm font-light tracking-wide md:text-base">
                    {stat.label}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
