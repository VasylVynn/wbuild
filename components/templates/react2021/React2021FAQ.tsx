"use client";

import { useState } from "react";
import type { BlockProps } from "@/lib/blocks/schema";

/*
 * FAQ — react-2021 has no dedicated FAQ source component, so this borrows the
 * coral design language from Features.tsx (uppercase kicker + extrabold
 * dark-ink heading) and pairs it with a single-column accordion of rounded
 * gray-50 rows. Same interaction pattern as AiSaasFAQ: useState openIndex,
 * one item open at a time, inline SVG indicator (a coral chevron here,
 * rotating 180° instead of the +/× cross) — no @headlessui/@heroicons.
 */
export default function React2021FAQ({ data }: { data: unknown }) {
  const d = data as BlockProps["faq"];
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="bg-white py-12 sm:py-16">
      <div className="mx-auto max-w-2xl px-4">
        <div className="text-center">
          <span className="text-sm font-semibold uppercase tracking-wide text-[#ec4755]">
            Питання та відповіді
          </span>
          {d.title && (
            <p className="mt-2 text-3xl font-extrabold tracking-tight text-[#1a2e35] sm:text-4xl">
              {d.title}
            </p>
          )}
        </div>

        <div className="mt-10 space-y-3">
          {d.items.map((item, i) => {
            const isOpen = openIndex === i;

            return (
              <div key={i} className="overflow-hidden rounded-lg bg-gray-50">
                <button
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                  aria-expanded={isOpen}
                  aria-controls={`react2021-faq-answer-${i}`}
                >
                  <span className="font-medium text-[#1a2e35]">{item.question}</span>
                  <svg
                    className="h-5 w-5 shrink-0 text-[#ec4755] transition-transform duration-300"
                    style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                <div
                  id={`react2021-faq-answer-${i}`}
                  className={`grid transition-all duration-300 ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
                >
                  <p className="overflow-hidden px-6 pb-5 text-gray-500">{item.answer}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
