"use client";

import type { BlockProps } from "@/lib/blocks/schema";
import { normalizeIgHandle } from "@/lib/blocks/contact-links";
import { formatFollowers } from "@/components/blocks/InstagramCta";
import { Reveal } from "../shared/reveal";

/*
 * InstagramCta — the `instagram_cta` block in studio dress: a violet-glow
 * statement panel (StudioBanner's move) with a `.btn-gradient` «Написати в
 * Direct» action. Handle/followers are grounded facts; link behaviour matches
 * components/blocks/InstagramCta.tsx (ig.me deep link, profile fallback).
 */
export default function InstagramCtaSection({ data }: { data: unknown }) {
  const d = data as BlockProps["instagram_cta"];
  const clean = normalizeIgHandle(d.handle);
  if (!clean) return null;

  return (
    <section className="py-12 md:py-16" aria-labelledby="ig-cta-title">
      <div className="container mx-auto px-4 sm:px-6">
        <Reveal
          margin="-80px"
          className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-14 md:py-16 text-center"
        >
          <div
            className="absolute -top-1/2 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full blur-[140px] opacity-[0.14] pointer-events-none"
            style={{ background: "radial-gradient(circle, #8B5CF6 0%, transparent 70%)" }}
            aria-hidden="true"
          />

          <div className="relative max-w-2xl mx-auto">
            <h2
              id="ig-cta-title"
              className="text-3xl md:text-4xl font-bold tracking-tight text-white leading-tight"
              style={{ letterSpacing: "-0.03em" }}
            >
              {d.title ?? "Ми в Instagram"}
            </h2>
            {d.subtitle && (
              <p className="mt-4 text-base md:text-lg text-zinc-400 leading-relaxed max-w-xl mx-auto">
                {d.subtitle}
              </p>
            )}

            <div className="mt-8 flex flex-col items-center gap-4">
              <a
                href={`https://ig.me/m/${clean}`}
                target="_blank"
                rel="noopener"
                className="btn-gradient"
              >
                {d.buttonLabel ?? "Написати в Direct"}
              </a>
              <p className="text-sm text-zinc-400">
                <a
                  href={`https://www.instagram.com/${clean}`}
                  target="_blank"
                  rel="noopener"
                  className="font-semibold text-white hover:text-[var(--color-accent)] transition-colors"
                >
                  @{clean}
                </a>
                {d.followersCount ? ` · ${formatFollowers(d.followersCount)}` : null}
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
