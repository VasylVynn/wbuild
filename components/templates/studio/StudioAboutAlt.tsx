"use client";

import { motion } from "framer-motion";
import type { BlockProps } from "@/lib/blocks/schema";

/*
 * About (alt layout) — centred single-column statement instead of the
 * default's two side-by-side cards: one elegant centred column carries the
 * story (first line accented via `gradient-text`), and any "- " principle
 * lines collapse into a centred row of inline chips below.
 */
export default function StudioAboutAlt({ data }: { data: unknown }) {
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
  const [firstLine, ...restOfFirst] = paragraphs[0]?.split(". ") ?? [];
  const restParagraphs = restOfFirst.length ? [restOfFirst.join(". "), ...paragraphs.slice(1)] : paragraphs.slice(1);

  return (
    <section className="py-12 md:py-16 border-t border-white/[0.04]" aria-labelledby="about-alt-title">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="max-w-2xl mx-auto text-center">
          {d.title && (
            <motion.h2
              id="about-alt-title"
              className="section-title"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6 }}
            >
              {d.title}
            </motion.h2>
          )}

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="mt-6"
          >
            {firstLine && (
              <p className="text-xl leading-relaxed">
                <span className="gradient-text font-medium">{firstLine}.</span>
              </p>
            )}
            {restParagraphs.map((p, i) => (
              <p key={i} className="text-zinc-500 text-sm leading-relaxed mt-4">
                {p}
              </p>
            ))}
          </motion.div>

          {principles.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="flex flex-wrap justify-center gap-2.5 mt-8"
            >
              {principles.map((principle, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-white/10 bg-white/[0.03] text-zinc-400 text-sm"
                >
                  <span className="w-1 h-1 rounded-full bg-[var(--color-accent)] shrink-0" />
                  {principle}
                </span>
              ))}
            </motion.div>
          )}
        </div>
      </div>
    </section>
  );
}
