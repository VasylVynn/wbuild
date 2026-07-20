"use client";

import type { BlockProps } from "@/lib/blocks/schema";
import { Reveal } from "../shared/reveal";

/*
 * Testimonials — social proof as a responsive grid of bordered quote `card`s,
 * distinct from the team roster (no faces, left-aligned, a large accent quote
 * glyph over the customer's words). Each card staggers in on scroll and the
 * author sits below a hairline divider. Fed by our `testimonials` block; the
 * `spotlight` variant restacks the same quotes as one centred column.
 */
export default function StudioTestimonials({ data }: { data: unknown }) {
  const d = data as BlockProps["testimonials"];

  return (
    <section className="py-12 md:py-16" aria-labelledby={d.title ? "testimonials-title" : undefined}>
      <div className="container mx-auto px-4 sm:px-6">
        {d.title && (
          <Reveal margin="-80px" className="text-center mb-16">
            <span className="inline-block text-xs font-medium tracking-widest uppercase text-[var(--color-accent)] mb-4">
              Відгуки
            </span>
            <h2 id="testimonials-title" className="section-title">{d.title}</h2>
          </Reveal>
        )}

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 max-w-6xl mx-auto">
          {d.items.map((item, i) => (
            <Reveal
              key={i}
              delay={i * 0.08}
              duration={0.5}
              margin="-80px"
              className="card flex flex-col"
            >
              <span
                aria-hidden="true"
                className="block text-5xl leading-none text-[var(--color-accent)] opacity-40 mb-3"
              >
                &ldquo;
              </span>
              <p className="text-zinc-300 text-[0.95rem] leading-relaxed flex-1">{item.quote}</p>
              <div className="mt-5 pt-4 border-t border-white/10">
                <p className="text-white font-semibold text-sm">{item.author}</p>
                {item.role && <p className="text-[var(--color-accent)] text-xs mt-0.5">{item.role}</p>}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
