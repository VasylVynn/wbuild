"use client";

import type { BlockProps } from "@/lib/blocks/schema";
import { RevealStagger, RevealItem } from "./Reveal";
import { SectionHeading } from "./SectionHeading";

/*
 * Timeline — the business's journey / experience as a connected vertical spine:
 * a gold hairline fades down the left edge with a ringed gold node per step,
 * each row carrying an optional period (gold, uppercase), a serif title, an
 * italic subtitle and a muted description. Deliberately un-boxed so it reads as
 * one continuous path — distinct from Publications' bordered year rows. The
 * node's navy ring punches it through the line and flips with the light theme.
 */
export default function FerriTimeline({ data }: { data: unknown }) {
  const d = data as BlockProps["timeline"];

  return (
    <section className="border-t border-gold-500/8 py-14 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {d.title && <SectionHeading title={d.title} />}

        <div className="relative mx-auto max-w-3xl">
          <span
            className="absolute bottom-2 left-[7px] top-2 w-px bg-gradient-to-b from-gold-500/40 via-gold-500/15 to-transparent"
            aria-hidden="true"
          />
          <RevealStagger className="space-y-10 sm:space-y-12">
            {d.items.map((item, i) => (
              <RevealItem key={i}>
                <div className="relative flex gap-6 sm:gap-8">
                  <span
                    className="relative z-10 mt-1.5 h-3.5 w-3.5 flex-none rounded-full bg-gold-500 ring-4 ring-navy-950"
                    aria-hidden="true"
                  />
                  <div className="flex-1 pb-1">
                    {item.period && (
                      <p className="text-xs uppercase tracking-[2px] text-gold-500">{item.period}</p>
                    )}
                    <h3 className="mt-1 font-[family-name:var(--ferri-display)] text-xl text-cream-100 sm:text-2xl">
                      {item.title}
                    </h3>
                    {item.subtitle && <p className="mt-1 italic text-txt-muted">{item.subtitle}</p>}
                    {item.description && (
                      <p className="mt-3 text-sm leading-relaxed text-txt-muted">{item.description}</p>
                    )}
                  </div>
                </div>
              </RevealItem>
            ))}
          </RevealStagger>
        </div>
      </div>
    </section>
  );
}
