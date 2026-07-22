"use client";

import type { BlockProps } from "@/lib/blocks/schema";
import { ScrollReveal } from "./ScrollReveal";

/*
 * Services — `menu` variant. A third services layout: where the default is a
 * glass card grid and the `rows` alt is alternating icon rows, this is a spa
 * price-menu — a single-column list inside one glass panel where each service
 * name (with its optional description) is tied to its price by a dotted leader
 * line. Density paradigm (card grid → menu list) and the name/price relationship
 * both differ from the base; the icon-chip media element is dropped.
 */
export default function SalonServicesMenu({ data }: { data: unknown }) {
  const d = data as BlockProps["services"];

  return (
    <section className="relative overflow-hidden bg-background py-16 transition-colors duration-1000 dark:bg-black sm:py-20 lg:py-24">
      <div className="pointer-events-none absolute right-0 top-0 h-[600px] w-[600px] rounded-full bg-accent/10 blur-[150px] mix-blend-multiply dark:mix-blend-screen" />

      <div className="section-container relative z-10">
        {d.title && (
          <ScrollReveal>
            <div className="section-header">
              <span className="section-tag">The Luxe Experience</span>
              <h2 className="section-title text-gradient-aurora">{d.title}</h2>
            </div>
          </ScrollReveal>
        )}

        <ScrollReveal delay={0.15}>
          <div className="glass-card mx-auto max-w-3xl divide-y divide-border p-8 sm:p-10">
            {d.items.map((item, index) => (
              <div key={index} className="py-5 first:pt-0 last:pb-0">
                <div className="flex items-baseline gap-3">
                  <h3 className="font-display text-xl font-semibold text-foreground sm:text-2xl">{item.name}</h3>
                  {item.price && (
                    <>
                      <span aria-hidden="true" className="min-w-6 flex-1 self-center border-b border-dotted border-border" />
                      <span className="font-display shrink-0 text-lg font-bold tracking-tight text-accent sm:text-xl">
                        {item.price}
                      </span>
                    </>
                  )}
                </div>
                {item.description && (
                  <p className="mt-2 max-w-2xl text-sm font-light leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
