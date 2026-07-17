"use client";

import { useState } from "react";
import type { BlockProps } from "@/lib/blocks/schema";

/*
 * FAQ — warm accordion for the `faq` block. Mirrors AiSaasFAQ's own
 * useState open-index interaction (no @headlessui): single-open toggle,
 * rounded sand rows, terracotta inline-SVG "+" that rotates 45° into a
 * "×" on open.
 */
export default function RestaurantFAQ({ data }: { data: unknown }) {
  const d = data as BlockProps["faq"];
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="bg-[#FBF6EF] py-16 sm:py-20">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        <span className="mb-3 block text-center text-sm font-semibold uppercase tracking-wide text-[#C0562F]">
          FAQ
        </span>

        {d.title && (
          <h2 className="mb-10 text-center text-3xl font-bold text-[#2A2018] md:text-4xl">{d.title}</h2>
        )}

        <div className="space-y-3">
          {d.items.map((item, i) => {
            const isOpen = openIndex === i;

            return (
              <div key={i} className="overflow-hidden rounded-xl bg-[#F3EADD]">
                <button
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                  aria-expanded={isOpen}
                  aria-controls={`restaurant-faq-answer-${i}`}
                >
                  <span className="font-display font-medium text-[#2A2018]">{item.question}</span>
                  <svg
                    className="h-5 w-5 shrink-0 text-[#C0562F] transition-transform duration-300"
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
                  id={`restaurant-faq-answer-${i}`}
                  className={`grid transition-all duration-300 ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
                >
                  <p className="overflow-hidden px-6 pb-5 leading-relaxed text-[#6F6257]">{item.answer}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
