"use client";

import type { BlockProps } from "@/lib/blocks/schema";
import { Reveal } from "./Reveal";

/*
 * FerriAboutAlt — alternate layout for the ferri about block: a full-width
 * statement band instead of the default's eyebrow-heading-body column. `d.title`
 * (if present) sits as a small gold label above a gold vertical rule; the
 * first paragraph of `d.body` runs as a very large italic serif pull-quote;
 * any remaining paragraphs (and a "- " list, same convention as the default)
 * follow underneath as supporting copy in a narrower column.
 */
export default function FerriAboutAlt({ data }: { data: unknown }) {
  const d = data as BlockProps["richText"];

  const blocks = d.body
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  const isListBlock = (block: string) => block.split("\n").every((l) => l.trim().startsWith("- "));
  const statement = blocks[0] && !isListBlock(blocks[0]) ? blocks[0] : undefined;
  const rest = statement ? blocks.slice(1) : blocks;

  return (
    <section className="border-t border-gold-500/8 py-16 sm:py-24 lg:py-28">
      <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <Reveal>
          {d.title && <p className="text-xs uppercase tracking-[3px] text-gold-500">{d.title}</p>}
          <div className="mx-auto mt-6 h-20 w-px bg-gradient-to-b from-transparent via-gold-500/50 to-transparent" />
        </Reveal>

        {statement && (
          <Reveal delay={0.1}>
            <p className="mt-8 font-[family-name:var(--font-cormorant)] text-3xl font-light italic leading-[1.25] text-cream-100 sm:text-4xl md:text-5xl">
              {statement}
            </p>
          </Reveal>
        )}

        {rest.length > 0 && (
          <Reveal delay={0.25} className="mx-auto mt-10 max-w-2xl space-y-6">
            {rest.map((block, i) => {
              const lines = block.split("\n").map((l) => l.trim());
              const isList = lines.every((l) => l.startsWith("- "));

              if (isList) {
                return (
                  <ul key={i} className="space-y-2.5 text-left">
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
                <p key={i} className="text-base leading-relaxed text-txt-muted">
                  {block}
                </p>
              );
            })}
          </Reveal>
        )}
      </div>
    </section>
  );
}
