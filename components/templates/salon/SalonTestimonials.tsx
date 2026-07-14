"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { BlockProps } from "@/lib/blocks/schema";
import { ScrollReveal } from "./ScrollReveal";

// Inline icons (no lucide) — decorative quote mark + carousel chevrons.
function QuoteIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M9.5 4C6 5.5 4 8.5 4 12.5c0 3 2 5.5 4.5 5.5 2 0 3.5-1.5 3.5-3.5 0-1.8-1.2-3.2-3-3.4.3-2 1.7-3.6 3.7-4.4L9.5 4Zm9 0C15 5.5 13 8.5 13 12.5c0 3 2 5.5 4.5 5.5 2 0 3.5-1.5 3.5-3.5 0-1.8-1.2-3.2-3-3.4.3-2 1.7-3.6 3.7-4.4L18.5 4Z" />
    </svg>
  );
}
function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}
function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

/*
 * Testimonials — port of the source `testimonials.tsx` single-card carousel:
 * a large glass-card with a decorative oversized quote icon, the active
 * quote, author + role, and prev/next/dot navigation.
 */
export default function SalonTestimonials({ data }: { data: unknown }) {
  const d = data as BlockProps["testimonials"];
  const [index, setIndex] = useState(0);

  const next = () => setIndex((i) => (i + 1) % d.items.length);
  const prev = () => setIndex((i) => (i - 1 + d.items.length) % d.items.length);

  const active = d.items[index];

  return (
    <section className="py-16 sm:py-20 lg:py-24">
      <div className="section-container">
        <ScrollReveal>
          <div className="section-header">
            {d.title && <h2 className="font-display section-title">{d.title}</h2>}
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.3}>
          <div className="mx-auto max-w-4xl">
            <div className="glass-card relative overflow-hidden p-10 sm:p-14 lg:p-16">
              <QuoteIcon className="text-accent absolute top-8 left-8 h-24 w-24 opacity-10" />

              <div className="relative z-10 text-center">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -30 }}
                    transition={{ duration: 0.5 }}
                  >
                    <div className="from-accent to-beauty-pink shadow-gold mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br">
                      <QuoteIcon className="h-8 w-8 text-white" />
                    </div>

                    <blockquote className="text-foreground font-display text-xl font-light leading-relaxed sm:text-2xl">
                      &ldquo;{active.quote}&rdquo;
                    </blockquote>

                    <div className="mt-8 space-y-1">
                      <p className="font-display text-gradient-gold text-xl font-semibold sm:text-2xl">
                        {active.author}
                      </p>
                      {active.role && (
                        <p className="text-muted-foreground tracking-wide">{active.role}</p>
                      )}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            {d.items.length > 1 && (
              <div className="mt-10 flex items-center justify-center gap-6">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.1, x: -5 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={prev}
                  aria-label="Попередній відгук"
                  className="bg-card border-border flex h-12 w-12 items-center justify-center rounded-full border transition-shadow hover:shadow-lg"
                >
                  <ChevronLeftIcon className="text-accent h-5 w-5" />
                </motion.button>

                <div className="flex gap-3">
                  {d.items.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setIndex(i)}
                      aria-label={`Відгук ${i + 1}`}
                      className={`h-2 rounded-full transition-all duration-500 ${
                        i === index
                          ? "from-accent to-beauty-pink w-10 bg-gradient-to-r"
                          : "bg-muted hover:bg-muted-foreground/30 w-2"
                      }`}
                    />
                  ))}
                </div>

                <motion.button
                  type="button"
                  whileHover={{ scale: 1.1, x: 5 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={next}
                  aria-label="Наступний відгук"
                  className="bg-card border-border flex h-12 w-12 items-center justify-center rounded-full border transition-shadow hover:shadow-lg"
                >
                  <ChevronRightIcon className="text-accent h-5 w-5" />
                </motion.button>
              </div>
            )}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
