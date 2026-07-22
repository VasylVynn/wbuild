"use client";

import type { BlockProps } from "@/lib/blocks/schema";
import { Reveal } from "../shared/reveal";

/*
 * How it works — verbatim port of the source HowItWorksSection: centred header
 * over a set of numbered steps (01, 02, 03…) that stagger in on scroll.
 *
 * Parameterised: fed by our `services` block. Each item → one step (index →
 * zero-padded number, name → heading, description → body). Price/icon/badge are
 * ignored. The source's section subtitle has no field, so only the title shows.
 */
export default function HowItWorksSection({ data }: { data: unknown }) {
  const d = data as BlockProps["services"];

  return (
    <section className="py-12 md:py-16 relative" aria-labelledby="how-it-works-title">
      <div className="container mx-auto px-4 sm:px-6">
        {d.title && (
          <Reveal margin="-80px" className="text-center mb-16">
            <h2 id="how-it-works-title" className="section-title">{d.title}</h2>
            {/* FIDELITY-TODO: needs schema field services.subtitle — source renders a section-subtitle <p> here */}
          </Reveal>
        )}

        <div className="grid md:grid-cols-3 gap-6 md:gap-8 max-w-4xl mx-auto">
          {d.items.map((item, i) => (
            <Reveal
              key={i}
              delay={0.1 + i * 0.15}
              duration={0.5}
              margin="-80px"
              className="text-center"
            >
              <span className="inline-block text-xs font-medium text-zinc-600 uppercase tracking-widest mb-4">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="text-lg font-semibold text-white mb-2">{item.name}</h3>
              {item.description && (
                <p className="text-zinc-500 text-sm leading-relaxed max-w-xs mx-auto">{item.description}</p>
              )}
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
