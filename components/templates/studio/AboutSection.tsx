"use client";

import { motion } from "framer-motion";
import type { BlockProps } from "@/lib/blocks/schema";

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
 * Fidelity deltas: the source's eyebrow label, per-card sub-headings and the
 * hard-coded tech-stack chip card have no field in our schema and are dropped.
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
    <section className="py-20 md:py-28 border-t border-white/[0.04]" aria-labelledby="about-title">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          {d.title && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6 }}
              className="mb-12"
            >
              <h2 id="about-title" className="section-title">{d.title}</h2>
            </motion.div>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className={`card ${hasPrinciples ? "" : "md:col-span-2"}`}
            >
              {paragraphs.map((p, i) => (
                <p
                  key={i}
                  className={`text-sm leading-relaxed ${i === 0 ? "text-zinc-400" : "text-zinc-500 mt-3"}`}
                >
                  {p}
                </p>
              ))}
            </motion.div>

            {hasPrinciples && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="card"
              >
                <ul className="space-y-2.5">
                  {principles.map((principle, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="w-1 h-1 rounded-full bg-[var(--color-accent)] mt-2 shrink-0" />
                      <span className="text-zinc-400 text-sm leading-relaxed">{principle}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
