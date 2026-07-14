"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { BlockProps } from "@/lib/blocks/schema";
import { ScrollReveal } from "./ScrollReveal";

/*
 * FAQ — salon-flavored single-open accordion. Mechanics mirror the studio
 * FAQSection (single openIndex, AnimatePresence height animation); everything
 * visual is restyled to the salon language: rounded glass rows, serif
 * questions, a gold +/× toggle that rotates 45° open.
 */
export default function SalonFAQ({ data }: { data: unknown }) {
  const d = data as BlockProps["faq"];
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="py-16 sm:py-20 lg:py-24" aria-labelledby="salon-faq-title">
      <div className="section-container">
        {d.title && (
          <ScrollReveal className="section-header">
            <p className="section-tag">Questions & Answers</p>
            <h2 id="salon-faq-title" className="section-title text-gradient-gold">
              {d.title}
            </h2>
          </ScrollReveal>
        )}

        <div className="max-w-3xl mx-auto space-y-4">
          {d.items.map((item, i) => {
            const isOpen = openIndex === i;

            return (
              <ScrollReveal key={i} delay={i * 0.06} className="card-glass !p-0 overflow-hidden">
                <button
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="w-full flex items-center justify-between gap-4 p-6 md:p-7 text-left rounded-3xl focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
                  aria-expanded={isOpen}
                  aria-controls={`salon-faq-answer-${i}`}
                >
                  <span className="font-display text-lg md:text-xl text-foreground pr-4">{item.question}</span>
                  <motion.span
                    animate={{ rotate: isOpen ? 45 : 0 }}
                    transition={{ duration: 0.25 }}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </motion.span>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      id={`salon-faq-answer-${i}`}
                      role="region"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <p className="px-6 md:px-7 pb-6 md:pb-7 text-muted-foreground leading-relaxed">
                        {item.answer}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
