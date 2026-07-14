"use client";

import { motion } from "framer-motion";
import type { BlockProps } from "@/lib/blocks/schema";
import { ScrollReveal } from "./ScrollReveal";

// Inline icon (no lucide) — decorative gold quote mark.
function QuoteIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M9.5 4C6 5.5 4 8.5 4 12.5c0 3 2 5.5 4.5 5.5 2 0 3.5-1.5 3.5-3.5 0-1.8-1.2-3.2-3-3.4.3-2 1.7-3.6 3.7-4.4L9.5 4Zm9 0C15 5.5 13 8.5 13 12.5c0 3 2 5.5 4.5 5.5 2 0 3.5-1.5 3.5-3.5 0-1.8-1.2-3.2-3-3.4.3-2 1.7-3.6 3.7-4.4L18.5 4Z" />
    </svg>
  );
}

/*
 * Testimonials (alt layout) — glass card grid instead of the default's
 * single-card carousel: every quote shown at once as a `card-glass` tile
 * with a gold quote mark, quote, and author/role, revealed with a
 * ScrollReveal stagger.
 */
export default function SalonTestimonialsAlt({ data }: { data: unknown }) {
  const d = data as BlockProps["testimonials"];

  return (
    <section className="py-16 sm:py-20 lg:py-24">
      <div className="section-container">
        <ScrollReveal>
          <div className="section-header">
            {d.title && <h2 className="font-display section-title">{d.title}</h2>}
          </div>
        </ScrollReveal>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {d.items.map((item, index) => (
            <ScrollReveal key={index} delay={index * 0.1}>
              <motion.div
                whileHover={{ y: -8 }}
                className="glass-card relative h-full flex flex-col overflow-hidden p-8 sm:p-10"
              >
                <QuoteIcon className="text-accent absolute top-6 right-6 h-16 w-16 opacity-10" />

                <div className="from-accent to-beauty-pink shadow-gold relative z-10 mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br">
                  <QuoteIcon className="h-6 w-6 text-white" />
                </div>

                <blockquote className="text-foreground font-display relative z-10 flex-1 text-lg font-light leading-relaxed">
                  &ldquo;{item.quote}&rdquo;
                </blockquote>

                <div className="relative z-10 mt-6 space-y-1">
                  <p className="font-display text-gradient-gold text-lg font-semibold">{item.author}</p>
                  {item.role && <p className="text-muted-foreground tracking-wide text-sm">{item.role}</p>}
                </div>
              </motion.div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
