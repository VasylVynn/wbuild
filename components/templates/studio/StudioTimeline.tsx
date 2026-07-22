"use client";

import type { BlockProps } from "@/lib/blocks/schema";
import { Reveal } from "../shared/reveal";

/*
 * Timeline — the business journey as a single vertical spine: a hair-lined
 * left rail with an accent node per milestone, each staggering in on scroll.
 * Distinct from "How it works" (centred numbered grid off `services`) — this
 * reads chronologically off our `timeline` block (period → accent label,
 * title, optional subtitle + description). The node's ring is the page bg so
 * it punches cleanly through the rail.
 */
export default function StudioTimeline({ data }: { data: unknown }) {
  const d = data as BlockProps["timeline"];

  return (
    <section className="py-12 md:py-16" aria-labelledby={d.title ? "timeline-title" : undefined}>
      <div className="container mx-auto px-4 sm:px-6">
        {d.title && (
          <Reveal margin="-80px" className="text-center mb-16">
            <span className="inline-block text-xs font-medium tracking-widest uppercase text-[var(--color-accent)] mb-4">
              Хронологія
            </span>
            <h2 id="timeline-title" className="section-title">{d.title}</h2>
          </Reveal>
        )}

        <div className="relative max-w-2xl mx-auto border-l border-white/10 pl-8 md:pl-10">
          {d.items.map((item, i) => (
            <Reveal
              key={i}
              delay={i * 0.1}
              duration={0.5}
              margin="-80px"
              className="relative pb-10 last:pb-0"
            >
              <span
                aria-hidden="true"
                className="absolute left-[-2rem] md:left-[-2.5rem] top-1.5 -translate-x-1/2 h-3 w-3 rounded-full bg-[var(--color-accent)] ring-4 ring-[var(--color-bg)]"
              />
              {item.period && (
                <span className="block text-xs font-medium tracking-widest uppercase text-[var(--color-accent)] mb-1">
                  {item.period}
                </span>
              )}
              <h3 className="text-lg font-semibold text-white">{item.title}</h3>
              {item.subtitle && <p className="text-zinc-400 text-sm mt-0.5">{item.subtitle}</p>}
              {item.description && (
                <p className="text-zinc-500 text-sm leading-relaxed mt-2">{item.description}</p>
              )}
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
