"use client";

import { useState } from "react";
import type { BlockProps } from "@/lib/blocks/schema";

/*
 * FAQ — single-open accordion of glass rows. No framer-motion here (portfolio
 * has no dependency on it): open/close is CSS-only, using a generous max-height
 * transition on the answer wrapper plus the shared `animate-fade-in` reveal for
 * the header. The toggle glyph is inline SVG, rotated 45deg (+ → ×) on open.
 */
export default function PortfolioFAQ({ data }: { data: unknown }) {
  const d = data as BlockProps["faq"];
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="py-16 sm:py-24" aria-labelledby="portfolio-faq-title">
      <div className="container mx-auto px-6">
        {d.title && (
          <div className="text-center mb-12 sm:mb-16 animate-fade-in">
            <h2 id="portfolio-faq-title" className="text-3xl sm:text-4xl font-semibold glow-text">
              {d.title}
            </h2>
          </div>
        )}

        <div className="max-w-3xl mx-auto space-y-3">
          {d.items.map((item, i) => {
            const isOpen = openIndex === i;

            return (
              <div key={i} className="glass rounded-2xl overflow-hidden">
                <button
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="w-full flex items-center justify-between gap-4 p-5 sm:p-6 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                  aria-expanded={isOpen}
                  aria-controls={`portfolio-faq-answer-${i}`}
                >
                  <span className="font-medium text-foreground">{item.question}</span>
                  <svg
                    className="w-5 h-5 shrink-0 text-primary transition-transform duration-200"
                    style={{ transform: isOpen ? "rotate(45deg)" : "rotate(0deg)" }}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                  </svg>
                </button>

                <div
                  id={`portfolio-faq-answer-${i}`}
                  role="region"
                  className="grid transition-all duration-300 ease-in-out"
                  style={{ gridTemplateRows: isOpen ? "1fr" : "0fr", opacity: isOpen ? 1 : 0 }}
                >
                  <div className="overflow-hidden">
                    <p className="px-5 sm:px-6 pb-5 sm:pb-6 text-sm leading-relaxed text-muted-foreground">
                      {item.answer}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
