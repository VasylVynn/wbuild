"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SectionHeading } from "./SectionHeading";
import { RevealStagger, RevealItem } from "./Reveal";
import type { BlockProps } from "@/lib/blocks/schema";

/*
 * FerriFAQ — no source equivalent; designed fresh for ferri's dark-navy/gold
 * aesthetic. Accordion MECHANICS (single-open useState + AnimatePresence
 * height animation) are ported verbatim from templates/studio/FAQSection;
 * the shell, borders, and glyph are restyled to ferri's sharp-corner DNA.
 */
export default function FerriFAQ({ data }: { data: unknown }) {
  const d = data as BlockProps["faq"];
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="border-t border-gold-500/8 py-14 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading label="FAQ" title={d.title ?? "Frequently Asked Questions"} />

        <RevealStagger className="mx-auto max-w-3xl space-y-3">
          {d.items.map((item, i) => {
            const isOpen = openIndex === i;

            return (
              <RevealItem key={i}>
                <div className="border border-gold-500/8 bg-navy-800/20">
                  <button
                    onClick={() => setOpenIndex(isOpen ? null : i)}
                    className="flex w-full items-center justify-between gap-4 p-5 text-left sm:p-6"
                    aria-expanded={isOpen}
                    aria-controls={`ferri-faq-answer-${i}`}
                  >
                    <span className="font-[family-name:var(--ferri-display)] text-lg text-cream-100 sm:text-xl">
                      {item.question}
                    </span>
                    <motion.svg
                      animate={{ rotate: isOpen ? 45 : 0 }}
                      transition={{ duration: 0.2 }}
                      className="h-4 w-4 shrink-0 text-gold-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                    </motion.svg>
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        id={`ferri-faq-answer-${i}`}
                        role="region"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <p className="px-5 pb-5 text-sm leading-relaxed text-txt-muted sm:px-6">
                          {item.answer}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </RevealItem>
            );
          })}
        </RevealStagger>
      </div>
    </section>
  );
}
