"use client";

import type { BlockProps } from "@/lib/blocks/schema";
import { ServiceIcon } from "@/components/blocks/icons";
import { Reveal } from "../shared/reveal";

/*
 * Features — verbatim port of the source FeaturesSection: a centred header and
 * a responsive grid of bordered icon cards that stagger in on scroll and warm
 * their icon to the accent on hover.
 *
 * Parameterised: fed by our `services` block. Each item → one card (icon via
 * ServiceIcon(item.icon), name → heading, description → body). Prices/badges
 * are ignored — this is the features look. The source's section subtitle has
 * no field in our schema, so only the title renders.
 */
export default function FeaturesSection({ data }: { data: unknown }) {
  const d = data as BlockProps["services"];

  return (
    <section className="py-12 md:py-16" aria-labelledby="features-title">
      <div className="container mx-auto px-4 sm:px-6">
        {d.title && (
          <Reveal margin="-80px" className="text-center mb-16">
            <h2 id="features-title" className="section-title">{d.title}</h2>
            {/* FIDELITY-TODO: needs schema field services.subtitle — source renders a section-subtitle <p> here */}
          </Reveal>
        )}

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 max-w-6xl mx-auto">
          {d.items.map((item, i) => (
            <Reveal
              key={i}
              delay={i * 0.08}
              duration={0.5}
              margin="-80px"
              className="card group"
            >
              <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-zinc-400 mb-4 group-hover:text-[var(--color-accent)] transition-colors">
                {item.icon && <ServiceIcon name={item.icon} className="w-6 h-6" />}
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{item.name}</h3>
              {item.description && (
                <p className="text-zinc-500 text-sm leading-relaxed">{item.description}</p>
              )}
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
