"use client";

import type { BlockProps } from "@/lib/blocks/schema";
import { ScrollReveal } from "./ScrollReveal";

/*
 * SalonAboutAlt — alternate layout for the salon about block: a two-column
 * editorial split instead of the default's single centred column. The
 * gradient `font-display` title runs large in the left column; the body
 * paragraphs (and any "- " list, same convention as the default) flow in the
 * right column, separated by a gold/gradient rule that runs horizontal on
 * mobile and vertical between the columns from `lg` up.
 */
export default function SalonAboutAlt({ data }: { data: unknown }) {
  const d = data as BlockProps["richText"];

  const blocks = d.body
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  return (
    <section className="py-16 sm:py-20 lg:py-24">
      <div className="section-container">
        <div className="grid lg:grid-cols-[1fr_auto_1fr] gap-10 lg:gap-12 items-start">
          <ScrollReveal direction="right">
            <span className="section-tag">Про нас</span>
            {d.title && (
              <h2 className="font-display text-gradient-primary mt-3 text-4xl font-bold leading-[1.05] sm:text-5xl lg:text-6xl">
                {d.title}
              </h2>
            )}
          </ScrollReveal>

          <div
            aria-hidden="true"
            className="h-px w-full bg-gradient-to-r from-transparent via-accent to-beauty-pink lg:h-auto lg:w-px lg:self-stretch lg:bg-gradient-to-b"
          />

          <ScrollReveal direction="left" delay={0.1}>
            {blocks.map((block, i) => {
              const lines = block.split("\n").map((l) => l.trim());
              const isList = lines.every((l) => l.startsWith("- "));

              if (isList) {
                return (
                  <ul key={i} className="mt-6 space-y-3 text-left first:mt-0">
                    {lines.map((l, j) => (
                      <li key={j} className="flex items-start gap-3">
                        <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                        <span className="text-muted-foreground text-lg font-light leading-relaxed">
                          {l.slice(2).trim()}
                        </span>
                      </li>
                    ))}
                  </ul>
                );
              }

              return (
                <p key={i} className="text-muted-foreground mt-6 text-lg font-light leading-relaxed first:mt-0">
                  {block}
                </p>
              );
            })}
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
