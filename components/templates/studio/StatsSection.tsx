"use client";

import type { BlockProps } from "@/lib/blocks/schema";
import { Reveal } from "../shared/reveal";

/*
 * Stats — a standalone number band that reuses the hero's stat-row treatment
 * (big tabular value over an uppercase, wide-tracked label). Fades up on
 * scroll. Fed by our `stats` block (optional title + value/label items).
 */
export default function StatsSection({ data }: { data: unknown }) {
  const d = data as BlockProps["stats"];

  return (
    <section className="py-12 md:py-16" aria-labelledby={d.title ? "stats-title" : undefined}>
      <div className="container mx-auto px-4 sm:px-6">
        {d.title && (
          <Reveal margin="-80px" className="text-center mb-16">
            <h2 id="stats-title" className="section-title">{d.title}</h2>
          </Reveal>
        )}

        <Reveal y={0} duration={0.8} margin="-80px" className="flex gap-12 md:gap-16 justify-center flex-wrap">
          {d.items.map((stat, i) => (
            <div key={i} className="text-center">
              <span className="block text-3xl md:text-4xl font-semibold text-white tabular-nums">{stat.value}</span>
              <span className="block text-xs uppercase tracking-widest text-zinc-500 mt-2">{stat.label}</span>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
