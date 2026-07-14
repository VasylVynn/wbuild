"use client";

import { useState } from "react";
import type { BlockProps } from "@/lib/blocks/schema";

/*
 * FAQ — restyled port of the source AI-SaaS faq.tsx. The source is a
 * two-column layout (heading left, borderless list right) with lucide
 * +/− icons; here it's a single-column accordion of rounded pastel rows
 * (schema has no per-item icon field to key off of) with a coral inline-SVG
 * "+" that rotates 45° into a "×" on open. Single-open via useState, same
 * as the source's activeIndex toggle.
 */
export default function AiSaasFAQ({ data }: { data: unknown }) {
  const d = data as BlockProps["faq"];
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="py-16">
      <div className="mx-auto max-w-4xl px-4">
        {d.title && (
          <h2 className="mb-10 text-center text-3xl font-bold text-[#2F4550] md:text-4xl">
            {d.title}
          </h2>
        )}

        <div className="space-y-3">
          {d.items.map((item, i) => {
            const isOpen = openIndex === i;

            return (
              <div key={i} className="overflow-hidden rounded-2xl bg-[#F1F0FB]">
                <button
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                  aria-expanded={isOpen}
                  aria-controls={`aisaas-faq-answer-${i}`}
                >
                  <span className="font-medium text-[#2F4550]">{item.question}</span>
                  <svg
                    className="h-5 w-5 shrink-0 text-[#E07A5F] transition-transform duration-300"
                    style={{ transform: isOpen ? "rotate(45deg)" : "rotate(0deg)" }}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </button>

                <div
                  id={`aisaas-faq-answer-${i}`}
                  className={`grid transition-all duration-300 ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
                >
                  <p className="overflow-hidden px-6 pb-5 text-[#2F4550]/80">{item.answer}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
