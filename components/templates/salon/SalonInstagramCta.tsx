"use client";

import type { BlockProps } from "@/lib/blocks/schema";
import { normalizeIgHandle } from "@/lib/blocks/contact-links";
import { formatFollowers } from "@/components/blocks/InstagramCta";
import { ScrollReveal } from "./ScrollReveal";

/*
 * InstagramCta — the `instagram_cta` block in salon dress: a centred luxe band
 * (SalonCTA's aurora-glow move) with a gradient serif heading, a gold pill
 * «Написати в Direct» and the @handle + follower proof beneath. Handle and
 * followers are grounded facts (assemble()); links match components/blocks/
 * InstagramCta.tsx.
 */
export default function SalonInstagramCta({ data }: { data: unknown }) {
  const d = data as BlockProps["instagram_cta"];
  const clean = normalizeIgHandle(d.handle);
  if (!clean) return null;

  return (
    <section
      className="relative overflow-hidden py-16 sm:py-20 lg:py-24"
      aria-labelledby="salon-ig-title"
    >
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[26rem] w-[26rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/20 blur-[120px]"
        aria-hidden="true"
      />

      <div className="section-container relative z-10">
        <ScrollReveal className="mx-auto max-w-2xl space-y-8 text-center">
          <h2
            id="salon-ig-title"
            className="font-display text-4xl font-bold leading-[1.1] text-gradient-aurora md:text-5xl"
          >
            {d.title ?? "Ми в Instagram"}
          </h2>

          {d.subtitle && (
            <p className="text-lg font-light leading-relaxed text-muted-foreground md:text-xl">
              {d.subtitle}
            </p>
          )}

          <div className="flex flex-col items-center gap-4">
            <a
              href={`https://ig.me/m/${clean}`}
              target="_blank"
              rel="noopener"
              className="btn-gold-luxe inline-flex items-center justify-center rounded-full px-12 py-4 text-lg font-medium"
            >
              {d.buttonLabel ?? "Написати в Direct"}
            </a>
            <p className="text-sm text-muted-foreground">
              <a
                href={`https://www.instagram.com/${clean}`}
                target="_blank"
                rel="noopener"
                className="font-semibold text-accent"
              >
                @{clean}
              </a>
              {d.followersCount ? ` · ${formatFollowers(d.followersCount)}` : null}
            </p>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
