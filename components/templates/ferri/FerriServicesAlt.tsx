"use client";

import type { BlockProps } from "@/lib/blocks/schema";
import { RevealStagger, RevealItem } from "./Reveal";
import { SectionHeading } from "./SectionHeading";

/*
 * FerriServicesAlt — alternate layout for the ferri services block. Where
 * the default renders bordered icon cards in a grid, this is a numbered
 * editorial list: each item is a full-width row led by a large gold serif
 * index (01, 02, 03…), followed by the serif name and description, with a
 * thin gold divider separating rows.
 */
export default function FerriServicesAlt({ data }: { data: unknown }) {
  const d = data as BlockProps["services"];

  return (
    <section className="border-t border-gold-500/8 py-14 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {d.title && <SectionHeading title={d.title} />}

        <RevealStagger className="border-t border-gold-500/10">
          {d.items.map((item, i) => (
            <RevealItem key={i}>
              <div className="group flex flex-col gap-4 border-b border-gold-500/10 py-8 transition-colors sm:flex-row sm:items-baseline sm:gap-8 sm:py-10">
                <span className="font-[family-name:var(--font-cormorant)] text-4xl font-light text-gold-500/50 transition-colors group-hover:text-gold-500 sm:w-20 sm:text-5xl">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="flex-1">
                  <h3 className="font-[family-name:var(--font-cormorant)] text-2xl text-cream-100 sm:text-3xl">
                    {item.name}
                  </h3>
                  {item.description && (
                    <p className="mt-2 max-w-xl text-sm leading-relaxed text-txt-muted">{item.description}</p>
                  )}
                  {item.price && <p className="mt-3 text-sm text-gold-500">{item.price}</p>}
                </div>
              </div>
            </RevealItem>
          ))}
        </RevealStagger>
      </div>
    </section>
  );
}
