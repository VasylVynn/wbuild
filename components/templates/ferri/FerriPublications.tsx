"use client";

import type { BlockProps } from "@/lib/blocks/schema";
import { RevealStagger, RevealItem } from "./Reveal";
import { SectionHeading } from "./SectionHeading";

/*
 * Publications — an editorial bibliography list: works, books, articles or
 * cases, each row led by a large faint gold year, a serif title, an italic
 * subtitle and a small source line. Rows stagger in on scroll like the rest
 * of ferri.
 */
export default function FerriPublications({ data }: { data: unknown }) {
  const d = data as BlockProps["publications"];

  return (
    <section className="border-t border-gold-500/8 py-14 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {d.title && <SectionHeading title={d.title} />}

        <RevealStagger className="mx-auto max-w-4xl divide-y divide-gold-500/8 border border-gold-500/8">
          {d.items.map((item, i) => (
            <RevealItem key={i}>
              <div className="flex flex-col gap-4 bg-navy-800/20 p-6 sm:flex-row sm:items-baseline sm:gap-8 sm:p-8">
                <span className="font-[family-name:var(--font-cormorant)] text-3xl text-gold-500/40">
                  {item.year}
                </span>
                <div>
                  <h3 className="font-[family-name:var(--font-cormorant)] text-xl text-cream-100">
                    {item.title}
                  </h3>
                  {item.subtitle && (
                    <p className="mt-1 italic text-txt-muted">{item.subtitle}</p>
                  )}
                  {item.source && (
                    <p className="mt-2 text-sm text-txt-muted">{item.source}</p>
                  )}
                </div>
              </div>
            </RevealItem>
          ))}
        </RevealStagger>
      </div>
    </section>
  );
}
