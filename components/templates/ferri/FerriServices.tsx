"use client";

import type { BlockProps } from "@/lib/blocks/schema";
import { RevealStagger, RevealItem } from "./Reveal";
import { SectionHeading } from "./SectionHeading";
import { ServiceIcon } from "@/components/blocks/icons";

/*
 * Services — port of the source ÁREAS DE ATUAÇÃO grid: a centred header
 * followed by bordered icon cards that stagger in on scroll and warm to gold
 * on hover.
 *
 * Parameterised: fed by our `services` block. Each item → one card (icon via
 * ServiceIcon(item.icon) when present, name → serif heading, description →
 * body, price → small gold line). The source's "Saiba mais" link routes to a
 * per-area detail page with no equivalent block field (and lead_form is out
 * of MVP — see schema.ts), so cards render as plain divs rather than links.
 */
export default function FerriServices({ data }: { data: unknown }) {
  const d = data as BlockProps["services"];

  return (
    <section className="border-t border-gold-500/8 py-14 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {d.title && <SectionHeading title={d.title} />}

        <RevealStagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {d.items.map((item, i) => (
            <RevealItem key={i}>
              <div className="group block border border-gold-500/8 bg-navy-800/30 p-6 transition-all hover:border-gold-500/20 hover:bg-navy-800/60 sm:p-8">
                {item.icon && (
                  <ServiceIcon
                    name={item.icon}
                    className="mb-4 h-7 w-7 text-gold-500/70 transition-colors group-hover:text-gold-500"
                  />
                )}
                <h3 className="font-[family-name:var(--ferri-display)] text-xl text-cream-100">
                  {item.name}
                </h3>
                {item.description && (
                  <p className="mt-2 text-sm leading-relaxed text-txt-muted">{item.description}</p>
                )}
                {item.price && <p className="mt-3 text-sm text-gold-500">{item.price}</p>}
              </div>
            </RevealItem>
          ))}
        </RevealStagger>
      </div>
    </section>
  );
}
