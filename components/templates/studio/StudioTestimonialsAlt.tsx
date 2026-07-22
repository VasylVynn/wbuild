"use client";

import type { BlockProps } from "@/lib/blocks/schema";
import { Reveal } from "../shared/reveal";

/*
 * Testimonials — `spotlight` variant. Same `testimonials` content as the grid,
 * restacked as a single centred column of oversized quotes separated by
 * hairline dividers. Reads slower and more editorial than the card grid; the
 * design language (accent role label, muted quote) is identical.
 */
export default function StudioTestimonialsAlt({ data }: { data: unknown }) {
  const d = data as BlockProps["testimonials"];

  return (
    <section className="py-12 md:py-16" aria-labelledby={d.title ? "testimonials-alt-title" : undefined}>
      <div className="container mx-auto px-4 sm:px-6">
        {d.title && (
          <Reveal margin="-80px" className="text-center mb-14">
            <h2 id="testimonials-alt-title" className="section-title">{d.title}</h2>
          </Reveal>
        )}

        <div className="max-w-3xl mx-auto divide-y divide-white/10">
          {d.items.map((item, i) => (
            <Reveal
              key={i}
              delay={i * 0.1}
              duration={0.6}
              margin="-80px"
              className="py-8 md:py-10 text-center first:pt-0 last:pb-0"
            >
              <p className="text-lg md:text-2xl text-zinc-200 leading-relaxed tracking-tight">
                &ldquo;{item.quote}&rdquo;
              </p>
              <p className="mt-5 text-sm font-semibold text-white">{item.author}</p>
              {item.role && <p className="text-[var(--color-accent)] text-xs mt-1">{item.role}</p>}
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
