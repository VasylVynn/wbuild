"use client";

import type { BlockProps } from "@/lib/blocks/schema";
import { Reveal } from "../shared/reveal";

/*
 * CTA — verbatim port of the source CTASection: a centred call-to-action band
 * with a soft accent wash behind it, fading up on scroll, ending in a gradient
 * button with a trailing arrow.
 *
 * Parameterised: fed by our `cta` block (title, subtitle, buttonLabel,
 * buttonHref). Fidelity delta: the source's secondary button links to ITS OWN
 * Telegram bot and its note line is product-specific copy — neither has a
 * schema field and both are vertical-specific content we can't fabricate for
 * an arbitrary tenant, so they stay dropped (see FIDELITY-TODO below).
 */
export default function CTASection({ data }: { data: unknown }) {
  const d = data as BlockProps["cta"];

  return (
    <section className="py-12 md:py-16 relative" aria-labelledby="cta-title">
      <div
        className="absolute inset-0 bg-gradient-to-b from-transparent via-[var(--color-accent)]/[0.03] to-transparent"
        aria-hidden="true"
      />

      <div className="container mx-auto px-4 sm:px-6 relative">
        <Reveal margin="-80px" className="text-center max-w-lg mx-auto">
          <h2 id="cta-title" className="section-title mb-4">{d.title}</h2>
          {d.subtitle && <p className="text-zinc-400 mb-8">{d.subtitle}</p>}

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a href={d.buttonHref ?? "#"} className="btn-gradient">
              {d.buttonLabel}
              <svg className="ml-2 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </a>
            {/* FIDELITY-TODO: needs schema field cta.secondaryButtonLabel / secondaryButtonHref — omitted (source's was a Telegram-bot-specific link) */}
          </div>

          {/* FIDELITY-TODO: needs schema field cta.note — omitted (source's note line was product-specific copy) */}
        </Reveal>
      </div>
    </section>
  );
}
