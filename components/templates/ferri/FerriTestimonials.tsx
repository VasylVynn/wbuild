"use client";

import { SectionHeading } from "./SectionHeading";
import { RevealStagger, RevealItem } from "./Reveal";
import type { BlockProps } from "@/lib/blocks/schema";

/*
 * FerriTestimonials — no source equivalent; designed fresh for ferri's
 * dark-navy/gold aesthetic. A stacked-card grid, each card led by an
 * oversized serif quotation mark (echoing the source's oversized publication
 * years) and closed by the same hairline divider used across the template.
 */
export default function FerriTestimonials({ data }: { data: unknown }) {
  const d = data as BlockProps["testimonials"];

  return (
    <section className="border-t border-gold-500/8 py-14 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading label="TESTIMONIALS" title={d.title ?? "What Clients Say"} />

        <RevealStagger className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
          {d.items.map((item, i) => (
            <RevealItem key={i}>
              <div className="flex h-full flex-col border border-gold-500/8 bg-navy-800/30 p-6 sm:p-8">
                <span
                  className="font-[family-name:var(--font-cormorant)] text-4xl leading-none text-gold-500/30"
                  aria-hidden="true"
                >
                  &ldquo;
                </span>
                <p className="mt-3 flex-1 text-[15px] italic leading-relaxed text-cream-200">
                  {item.quote}
                </p>
                <div className="mt-6 h-px w-8 bg-gold-500/40" />
                <p className="mt-4 text-sm text-cream-100">{item.author}</p>
                {item.role && (
                  <p className="mt-1 text-xs uppercase tracking-[1.5px] text-gold-600">{item.role}</p>
                )}
              </div>
            </RevealItem>
          ))}
        </RevealStagger>
      </div>
    </section>
  );
}
