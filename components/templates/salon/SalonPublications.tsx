"use client";

import { motion } from "framer-motion";
import type { BlockProps } from "@/lib/blocks/schema";
import { ScrollReveal } from "./ScrollReveal";

/*
 * Publications — a framed "press & recognition" ledger: each entry is a
 * hairline-separated row with a serif title + optional note on the left and a
 * gold year / source on the right. The glass-card frame and quiet ledger
 * rhythm set it apart from the numbered process steps, the service cards and
 * the testimonial carousel — a calm, credibility-building list, not a grid.
 */
export default function SalonPublications({ data }: { data: unknown }) {
  const d = data as BlockProps["publications"];

  return (
    <section className="py-16 sm:py-20 lg:py-24 bg-background dark:bg-black relative overflow-hidden transition-colors duration-1000">
      <div className="absolute top-10 right-1/4 w-[420px] h-[420px] bg-accent/10 rounded-full blur-[140px] mix-blend-multiply dark:mix-blend-screen pointer-events-none" />

      <div className="section-container relative z-10">
        {d.title && (
          <ScrollReveal>
            <div className="section-header">
              <span className="section-tag">Визнання</span>
              <h2 className="section-title text-gradient-gold">{d.title}</h2>
            </div>
          </ScrollReveal>
        )}

        <ScrollReveal>
          <div className="glass-card mx-auto max-w-4xl divide-y divide-border/60">
            {d.items.map((item, index) => (
              <motion.div
                key={index}
                whileHover={{ x: 6 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="group flex flex-col gap-3 px-6 py-7 sm:flex-row sm:items-baseline sm:justify-between sm:gap-8 sm:px-10"
              >
                <div className="space-y-1">
                  <h3 className="font-display text-xl sm:text-2xl font-semibold leading-snug text-foreground dark:text-white transition-colors duration-300 group-hover:text-accent">
                    {item.title}
                  </h3>
                  {item.subtitle && (
                    <p className="text-muted-foreground text-sm font-light">{item.subtitle}</p>
                  )}
                </div>

                {(item.year || item.source) && (
                  <div className="shrink-0 text-left sm:text-right">
                    {item.year && (
                      <span className="font-display text-lg font-bold text-accent">{item.year}</span>
                    )}
                    {item.source && (
                      <p className="text-muted-foreground/80 text-xs uppercase tracking-[0.2em] font-medium">
                        {item.source}
                      </p>
                    )}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
