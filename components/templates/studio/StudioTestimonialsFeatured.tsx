"use client";

import type { BlockProps } from "@/lib/blocks/schema";
import { Reveal } from "../shared/reveal";

/*
 * Testimonials — `featured` variant. Same `testimonials` content, restructured
 * from the symmetric card grid into an asymmetric bento: the first quote fills
 * a large featured panel, the rest stack as a compact register beside it.
 * Column axis (symmetric grid → big-plus-list), density paradigm and element
 * order all differ from the base grid — and from the `spotlight` column.
 */
export default function StudioTestimonialsFeatured({ data }: { data: unknown }) {
  const d = data as BlockProps["testimonials"];
  const [lead, ...rest] = d.items;
  if (!lead) return null;

  return (
    <section
      className="py-12 md:py-16"
      aria-labelledby={d.title ? "testimonials-featured-title" : undefined}
    >
      <div className="container mx-auto px-4 sm:px-6">
        {d.title && (
          <Reveal margin="-80px" className="mb-12">
            <span className="mb-4 inline-block text-xs font-medium uppercase tracking-widest text-[var(--color-accent)]">
              Відгуки
            </span>
            <h2 id="testimonials-featured-title" className="section-title">
              {d.title}
            </h2>
          </Reveal>
        )}

        <div className="mx-auto grid max-w-6xl gap-4 md:gap-5 lg:grid-cols-[1.3fr_1fr]">
          <Reveal margin="-80px" className="card gradient-border flex flex-col justify-center">
            <span aria-hidden="true" className="block text-7xl leading-none text-[var(--color-accent)] opacity-40">
              &ldquo;
            </span>
            <p className="mt-2 text-xl leading-relaxed tracking-tight text-zinc-100 md:text-2xl">{lead.quote}</p>
            <div className="mt-8 border-t border-white/10 pt-5">
              <p className="font-semibold text-white">{lead.author}</p>
              {lead.role && <p className="mt-0.5 text-xs text-[var(--color-accent)]">{lead.role}</p>}
            </div>
          </Reveal>

          {rest.length > 0 && (
            <div className="flex flex-col gap-4 md:gap-5">
              {rest.map((item, i) => (
                <Reveal key={i} delay={i * 0.08} margin="-80px" className="card flex flex-col">
                  <p className="text-[0.95rem] leading-relaxed text-zinc-300">{item.quote}</p>
                  <div className="mt-4 border-t border-white/10 pt-3">
                    <p className="text-sm font-semibold text-white">{item.author}</p>
                    {item.role && <p className="mt-0.5 text-xs text-[var(--color-accent)]">{item.role}</p>}
                  </div>
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
