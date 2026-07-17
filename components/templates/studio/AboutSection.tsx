"use client";

import type { BlockProps } from "@/lib/blocks/schema";
import { Reveal } from "../shared/reveal";

/*
 * About — port of the source AboutSection's story-card + principles layout: a
 * header, then a two-column grid of bordered cards that stagger in on scroll.
 *
 * Parameterised: fed by our `richText` block. The `body` is parsed once —
 * lines starting with "- " become the principles list (right card, accent
 * bullets); the remaining text is split on blank lines into the story
 * paragraphs (left card). When there are no principle lines the right card is
 * hidden and the story card spans the full width.
 *
 * Fidelity deltas: the source's eyebrow label and per-card sub-headings have
 * no field in our schema — restored with generic fallback copy (see
 * FIDELITY-TODO below). The source's third card is a hard-coded chip list of
 * ITS OWN tech stack (Next.js, React, Claude API…) — vertical-specific to the
 * source product, not something we can fabricate for an arbitrary tenant site,
 * so it stays dropped rather than rendered with invented content.
 */
export default function AboutSection({ data }: { data: unknown }) {
  const d = data as BlockProps["richText"];

  const lines = d.body.split("\n");
  const principles = lines
    .filter((l) => l.trim().startsWith("- "))
    .map((l) => l.trim().slice(2).trim())
    .filter(Boolean);
  const paragraphs = lines
    .filter((l) => !l.trim().startsWith("- "))
    .join("\n")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const hasPrinciples = principles.length > 0;

  return (
    <section className="py-12 md:py-16 border-t border-white/[0.04]" aria-labelledby="about-title">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          {d.title && (
            <Reveal margin="-80px" className="mb-12">
              {/* FIDELITY-TODO: needs schema field richText.eyebrow — fallback used */}
              <span className="inline-block text-xs font-medium tracking-widest uppercase text-[var(--color-accent)] mb-4">
                Про нас
              </span>
              <h2 id="about-title" className="section-title">{d.title}</h2>
            </Reveal>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            <Reveal
              delay={0.1}
              duration={0.5}
              margin="-80px"
              className={`card ${hasPrinciples ? "" : "md:col-span-2"}`}
            >
              {/* FIDELITY-TODO: needs schema field richText.storyHeading — fallback used */}
              <h3 className="text-lg font-semibold text-white mb-3">Наша історія</h3>
              {paragraphs.map((p, i) => (
                <p
                  key={i}
                  className={`text-sm leading-relaxed ${i === 0 ? "text-zinc-400" : "text-zinc-500 mt-3"}`}
                >
                  {p}
                </p>
              ))}
            </Reveal>

            {hasPrinciples && (
              <Reveal delay={0.2} duration={0.5} margin="-80px" className="card">
                {/* FIDELITY-TODO: needs schema field richText.principlesHeading — fallback used */}
                <h3 className="text-lg font-semibold text-white mb-3">Наші принципи</h3>
                <ul className="space-y-2.5">
                  {principles.map((principle, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="w-1 h-1 rounded-full bg-[var(--color-accent)] mt-2 shrink-0" />
                      <span className="text-zinc-400 text-sm leading-relaxed">{principle}</span>
                    </li>
                  ))}
                </ul>
              </Reveal>
            )}

            {/* FIDELITY-TODO: needs schema field richText.techStack (chip list) — source's
                third card is its own product's hard-coded stack, so omitted rather than
                faked for arbitrary tenant verticals. */}
          </div>
        </div>
      </div>
    </section>
  );
}
