"use client";

import type { BlockProps } from "@/lib/blocks/schema";
import { RevealStagger, RevealItem } from "./Reveal";
import { SectionHeading } from "./SectionHeading";
import { ServiceIcon } from "@/components/blocks/icons";

/*
 * FerriServicesBento — a third services layout. Where the default is a uniform
 * icon-card grid and the `numbered` alt is a full-width editorial list, this is
 * a bento: the first service fills one wide featured tile (oversized serif +
 * icon, gold-gradient corner glow), the rest sit as smaller tiles in the grid
 * beside it. Column axis (uniform grid → asymmetric big-plus-grid) and density
 * paradigm both differ from the base.
 */
export default function FerriServicesBento({ data }: { data: unknown }) {
  const d = data as BlockProps["services"];
  const [lead, ...rest] = d.items;
  if (!lead) return null;

  return (
    <section className="border-t border-gold-500/8 py-14 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {d.title && <SectionHeading title={d.title} />}

        <RevealStagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <RevealItem className="sm:col-span-2">
            <div className="group relative flex h-full flex-col justify-between overflow-hidden border border-gold-500/20 bg-navy-800/40 p-8 transition-all hover:border-gold-500/40 sm:p-10">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-gold-500/10 blur-2xl"
              />
              <div className="relative">
                {lead.icon && (
                  <ServiceIcon
                    name={lead.icon}
                    className="mb-6 h-10 w-10 text-gold-500/80 transition-colors group-hover:text-gold-500"
                  />
                )}
                <h3 className="font-[family-name:var(--ferri-display)] text-3xl text-cream-100 sm:text-4xl">
                  {lead.name}
                </h3>
                {lead.description && (
                  <p className="mt-4 max-w-md text-base leading-relaxed text-txt-muted">{lead.description}</p>
                )}
              </div>
              {lead.price && <p className="relative mt-8 text-base text-gold-500">{lead.price}</p>}
            </div>
          </RevealItem>

          {rest.map((item, i) => (
            <RevealItem key={i}>
              <div className="group block h-full border border-gold-500/8 bg-navy-800/30 p-6 transition-all hover:border-gold-500/20 hover:bg-navy-800/60 sm:p-8">
                {item.icon && (
                  <ServiceIcon
                    name={item.icon}
                    className="mb-4 h-7 w-7 text-gold-500/70 transition-colors group-hover:text-gold-500"
                  />
                )}
                <h3 className="font-[family-name:var(--ferri-display)] text-xl text-cream-100">{item.name}</h3>
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
