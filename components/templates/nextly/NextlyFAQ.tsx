"use client";

import { useState } from "react";
import type { BlockProps } from "@/lib/blocks/schema";

/*
 * FAQ — port of nextly's Faq.tsx accordion (gray-50 rows, indigo chevron
 * that rotates 180° when open) rebuilt without @headlessui/@heroicons: a
 * plain useState open-index toggle + inline chevron SVG, same interaction
 * pattern as AiSaasFAQ. Single-open accordion, mx-auto max-w-2xl container
 * per the source.
 */
export default function NextlyFAQ({ data }: { data: unknown }) {
  const d = data as BlockProps["faq"];
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="bg-white py-16 dark:bg-neutral-900 lg:py-20">
      <div className="mx-auto max-w-2xl px-4">
        {d.title && (
          <div className="mb-10 flex flex-col items-center text-center">
            <span className="text-sm font-bold tracking-wider text-indigo-600 uppercase">
              Питання
            </span>
            <h2 className="mt-3 text-3xl font-bold leading-snug tracking-tight text-gray-800 lg:text-4xl lg:leading-tight dark:text-white">
              {d.title}
            </h2>
          </div>
        )}

        <div className="w-full rounded-2xl">
          {d.items.map((item, i) => {
            const isOpen = openIndex === i;

            return (
              <div key={i} className="mb-5">
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="flex w-full items-center justify-between rounded-lg bg-gray-50 px-4 py-4 text-left text-lg text-gray-800 hover:bg-gray-100 focus:outline-none dark:bg-neutral-800 dark:text-gray-200"
                  aria-expanded={isOpen}
                  aria-controls={`nextly-faq-answer-${i}`}
                >
                  <span>{item.question}</span>
                  <svg
                    className={`h-5 w-5 shrink-0 text-indigo-500 transition-transform duration-200 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                  </svg>
                </button>

                {isOpen && (
                  <div id={`nextly-faq-answer-${i}`} className="px-4 pt-4 pb-2 text-gray-500 dark:text-gray-300">
                    {item.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
