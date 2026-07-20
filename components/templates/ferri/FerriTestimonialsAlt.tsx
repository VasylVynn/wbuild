"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { BlockProps } from "@/lib/blocks/schema";
import { SectionHeading } from "./SectionHeading";

/*
 * FerriTestimonialsAlt — alternate layout for the ferri testimonials block.
 * Where the default is a 3-col grid, this is a single spotlight: one large
 * centered serif quote at a time, led by an oversized gold quotation mark,
 * with author/role beneath and dot navigation to step through the rest.
 */
export default function FerriTestimonialsAlt({ data }: { data: unknown }) {
  const d = data as BlockProps["testimonials"];
  const [active, setActive] = useState(0);
  const item = d.items[active];

  return (
    <section className="border-t border-gold-500/8 py-14 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <SectionHeading label="TESTIMONIALS" title={d.title ?? "What Clients Say"} />

        {item && (
          <div className="text-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                <span
                  className="font-[family-name:var(--ferri-display)] text-7xl leading-none text-gold-500/30 sm:text-8xl"
                  aria-hidden="true"
                >
                  &ldquo;
                </span>
                <p className="mx-auto -mt-4 max-w-xl font-[family-name:var(--ferri-display)] text-2xl italic leading-snug text-cream-200 sm:text-3xl">
                  {item.quote}
                </p>
                <div className="mx-auto mt-8 h-px w-8 bg-gold-500/40" />
                <p className="mt-4 text-sm text-cream-100">{item.author}</p>
                {item.role && (
                  <p className="mt-1 text-xs uppercase tracking-[1.5px] text-gold-600">{item.role}</p>
                )}
              </motion.div>
            </AnimatePresence>

            {d.items.length > 1 && (
              <div className="mt-10 flex items-center justify-center gap-3">
                {d.items.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Show testimonial ${i + 1}`}
                    onClick={() => setActive(i)}
                    className={`h-1.5 w-1.5 rounded-full transition-all ${
                      i === active ? "w-5 bg-gold-500" : "bg-gold-500/30 hover:bg-gold-500/60"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
