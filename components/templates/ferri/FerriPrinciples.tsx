import type { BlockProps } from "@/lib/blocks/schema";
import { Reveal } from "./Reveal";

/*
 * FerriPrinciples — a second richText layout, split two-column on desktop: the
 * left rail holds a gold eyebrow, a serif heading and a gold rule (sticky as the
 * body scrolls); the right column runs the parsed body — paragraphs, or a "- "
 * bulleted principles/values list (same convention as FerriAbout). Distinct in
 * purpose and shape from About (centred narrative column) and AboutAlt (centred
 * pull-quote): this one reads as "how we work / what we stand by".
 */
export default function FerriPrinciples({ data }: { data: unknown }) {
  const d = data as BlockProps["richText"];

  const blocks = d.body
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  return (
    <section className="border-t border-gold-500/8 py-14 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[2fr_3fr] lg:gap-16">
          <Reveal>
            <div className="lg:sticky lg:top-24">
              <p className="text-xs uppercase tracking-[3px] text-gold-500">Підхід</p>
              {d.title && (
                <h2 className="mt-3 font-[family-name:var(--ferri-display)] text-2xl font-normal leading-tight text-cream-100 sm:text-3xl md:text-4xl">
                  {d.title}
                </h2>
              )}
              <div className="mt-6 h-px w-12 bg-gold-500/40" />
            </div>
          </Reveal>

          <Reveal delay={0.15} className="space-y-6">
            {blocks.map((block, i) => {
              const lines = block.split("\n").map((l) => l.trim());
              const isList = lines.every((l) => l.startsWith("- "));

              if (isList) {
                return (
                  <ul key={i} className="space-y-4">
                    {lines.map((l, j) => (
                      <li key={j} className="flex items-start gap-4 border-b border-gold-500/10 pb-4 last:border-0 last:pb-0">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 bg-gold-500" aria-hidden="true" />
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
        </div>
      </div>
    </section>
  );
}
