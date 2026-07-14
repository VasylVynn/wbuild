"use client";

import type { BlockProps } from "@/lib/blocks/schema";
import { ScrollReveal } from "./ScrollReveal";

/*
 * CTA — a centered luxe closing band: gradient serif heading, soft subtitle,
 * gold pill button, with a blurred gold glow behind the copy for depth —
 * the same radial-glow move the source hero/services/contact sections use.
 */
export default function SalonCTA({ data }: { data: unknown }) {
  const d = data as BlockProps["cta"];

  return (
    <section className="relative overflow-hidden py-16 sm:py-20 lg:py-24" aria-labelledby="salon-cta-title">
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/20 blur-[120px]"
        aria-hidden="true"
      />

      <div className="section-container relative z-10">
        <ScrollReveal className="mx-auto max-w-2xl text-center space-y-8">
          <h2
            id="salon-cta-title"
            className="font-display text-4xl md:text-5xl lg:text-6xl font-bold leading-[1.1] text-gradient-gold"
          >
            {d.title}
          </h2>

          {d.subtitle && (
            <p className="text-muted-foreground text-lg md:text-xl leading-relaxed font-light">{d.subtitle}</p>
          )}

          <a
            href={d.buttonHref ?? "#"}
            className="btn-gold-luxe inline-flex items-center justify-center rounded-full px-12 py-4 font-medium text-lg"
          >
            {d.buttonLabel}
          </a>
        </ScrollReveal>
      </div>
    </section>
  );
}
