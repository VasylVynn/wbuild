"use client";

import type { BlockProps } from "@/lib/blocks/schema";
import { Reveal } from "./Reveal";

/*
 * About — text-focused port of the source ABOUT PREVIEW: eyebrow label,
 * serif heading, gold divider, then flowing body copy. The source's portrait
 * photo has no equivalent in our `richText` block (title + body only), so
 * this is the text column alone, standing as its own centred section.
 *
 * Body parsing: `d.body` is split on blank lines into paragraphs. A
 * paragraph whose every line starts with "- " renders as a bulleted list
 * (gold dot markers) instead of prose, so a single field can carry both a
 * narrative and a short principles/values list, mirroring the AboutSection
 * port's richText handling elsewhere in the app.
 */
export default function FerriAbout({ data }: { data: unknown }) {
  const d = data as BlockProps["richText"];
  const align = d.align ?? "left";
  const alignClass = align === "center" ? "text-center" : "text-left";

  const blocks = d.body
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  return (
    <section className="border-t border-gold-500/8 py-14 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className={`mx-auto max-w-3xl ${alignClass}`}>
          <p className="text-xs uppercase tracking-[3px] text-gold-500">Про нас</p>

          {d.title && (
            <h2 className="mt-3 font-[family-name:var(--ferri-display)] text-2xl font-normal text-cream-100 sm:text-3xl md:text-4xl">
              {d.title}
            </h2>
          )}

          <div className={`mt-4 h-px w-12 bg-gold-500/40 ${align === "center" ? "mx-auto" : ""}`} />

          {blocks.map((block, i) => {
            const lines = block.split("\n").map((l) => l.trim());
            const isList = lines.every((l) => l.startsWith("- "));

            if (isList) {
              return (
                <ul key={i} className="mt-6 space-y-2.5 text-left">
                  {lines.map((l, j) => (
                    <li key={j} className="flex items-start gap-2.5">
                      <span className="mt-2 h-1 w-1 shrink-0 bg-gold-500" />
                      <span className="text-base leading-relaxed text-txt-muted">{l.slice(2).trim()}</span>
                    </li>
                  ))}
                </ul>
              );
            }

            return (
              <p key={i} className="mt-6 text-base leading-relaxed text-txt-muted">
                {block}
              </p>
            );
          })}
        </Reveal>
      </div>
    </section>
  );
}
