"use client";

import type { BlockProps } from "@/lib/blocks/schema";
import { Reveal } from "../shared/reveal";

/*
 * Banner — a full-width statement band, not a CTA: a dark panel with a
 * violet gradient glow behind large centred title + supporting subtitle.
 * Deliberately renders no button — buttonLabel/buttonHref are ignored so
 * this reads as a rhythm-breaker between action-oriented sections rather
 * than another conversion prompt.
 */
export default function StudioBanner({ data }: { data: unknown }) {
  const d = data as BlockProps["cta"];

  return (
    <section className="py-12 md:py-16" aria-labelledby="banner-title">
      <div className="container mx-auto px-4 sm:px-6">
        <Reveal
          margin="-80px"
          className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-16 md:py-24 text-center"
        >
          <div
            className="absolute -top-1/2 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full blur-[160px] opacity-[0.12] pointer-events-none"
            style={{ background: "radial-gradient(circle, #8B5CF6 0%, transparent 70%)" }}
            aria-hidden="true"
          />

          <div className="relative max-w-3xl mx-auto">
            <h2
              id="banner-title"
              className="text-3xl md:text-5xl font-bold tracking-tight text-white leading-tight"
              style={{ letterSpacing: "-0.03em" }}
            >
              {d.title}
            </h2>
            {d.subtitle && (
              <p className="mt-5 text-base md:text-lg text-zinc-400 leading-relaxed max-w-xl mx-auto">
                {d.subtitle}
              </p>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
