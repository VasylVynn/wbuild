"use client";

import type { BlockProps } from "@/lib/blocks/schema";
import { ScrollReveal } from "./ScrollReveal";

/*
 * About — text-focused port of the source `about.tsx` philosophy copy. The
 * source pairs the portrait photo with a text column; `richText` has no
 * image field, so this keeps only the text column, standing as its own
 * centred/left-aligned section (title, gold divider, flowing paragraphs).
 *
 * Body parsing: `d.body` splits on blank lines into paragraphs. A paragraph
 * whose every line starts with "- " renders as a refined bulleted list (gold
 * dot markers) instead of prose.
 */
export default function SalonAbout({ data }: { data: unknown }) {
  const d = data as BlockProps["richText"];
  const align = d.align ?? "left";
  const alignClass = align === "center" ? "text-center" : "text-left";

  const blocks = d.body
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  return (
    <section className="py-16 sm:py-20 lg:py-24">
      <div className="section-container">
        <ScrollReveal className={`mx-auto max-w-3xl ${alignClass}`}>
          <p className="section-tag">Про нас</p>

          {d.title && (
            <h2 className="font-display text-gradient-gold mt-3 text-3xl font-semibold sm:text-4xl md:text-5xl">
              {d.title}
            </h2>
          )}

          <div className={`mt-6 h-1 w-20 rounded-full bg-gradient-to-r from-accent to-beauty-pink ${align === "center" ? "mx-auto" : ""}`} />

          {blocks.map((block, i) => {
            const lines = block.split("\n").map((l) => l.trim());
            const isList = lines.every((l) => l.startsWith("- "));

            if (isList) {
              return (
                <ul key={i} className="mt-6 space-y-3 text-left">
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
              <p key={i} className="text-muted-foreground mt-6 text-lg font-light leading-relaxed">
                {block}
              </p>
            );
          })}
        </ScrollReveal>
      </div>
    </section>
  );
}
