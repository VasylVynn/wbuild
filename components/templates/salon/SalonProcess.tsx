"use client";

import type { BlockProps } from "@/lib/blocks/schema";
import { ScrollReveal } from "./ScrollReveal";

/*
 * Process — "your visit" flow rendered as numbered steps: a big gold
 * zero-padded index, the step name, optional small tag, and a description.
 * Steps connect via a thin accent line — horizontal on lg, vertical on
 * mobile — matching the salon's elegant, editorial feel (no photography).
 */
export default function SalonProcess({ data }: { data: unknown }) {
  const d = data as BlockProps["timeline"];

  return (
    <section className="py-16 sm:py-20 lg:py-24 bg-background dark:bg-black relative overflow-hidden transition-colors duration-1000">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-accent/10 rounded-full blur-[150px] mix-blend-multiply dark:mix-blend-screen pointer-events-none" />

      <div className="section-container relative z-10">
        {d.title && (
          <ScrollReveal>
            <div className="section-header">
              <span className="section-tag">Ваш візит</span>
              <h2 className="section-title text-gradient-gold">{d.title}</h2>
            </div>
          </ScrollReveal>
        )}

        <div className="relative flex flex-col lg:flex-row lg:items-start gap-12 lg:gap-6">
          {d.items.map((item, index) => (
            <ScrollReveal key={index} delay={index * 0.1} className="relative flex-1">
              <div className="relative flex flex-col items-start lg:items-center lg:text-center">
                {/* Connector line to the next step */}
                {index < d.items.length - 1 && (
                  <>
                    <span className="absolute left-6 top-16 bottom-[-3rem] w-px bg-gradient-to-b from-accent/40 to-transparent lg:hidden" />
                    <span className="hidden lg:block absolute top-8 left-1/2 w-full h-px bg-gradient-to-r from-accent/40 to-transparent" />
                  </>
                )}

                <span className="font-display text-5xl sm:text-6xl font-bold text-gradient-gold leading-none">
                  {String(index + 1).padStart(2, "0")}
                </span>

                <div className="mt-6 space-y-2 max-w-xs">
                  {item.period && (
                    <span className="block text-xs uppercase tracking-widest text-accent font-semibold">
                      {item.period}
                    </span>
                  )}
                  <h3 className="font-display text-2xl font-semibold text-foreground dark:text-white leading-tight">
                    {item.title}
                  </h3>
                  {item.subtitle && (
                    <span className="inline-block text-xs uppercase tracking-wider text-muted-foreground/80 font-medium">
                      {item.subtitle}
                    </span>
                  )}
                  {item.description && (
                    <p className="text-muted-foreground font-light leading-relaxed">
                      {item.description}
                    </p>
                  )}
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
