"use client";

import { motion } from "framer-motion";
import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Stats — a standalone number band that reuses the hero's stat-row treatment
 * (big tabular value over an uppercase, wide-tracked label). Fades up on
 * scroll. Fed by our `stats` block (optional title + value/label items).
 */
export default function StatsSection({ data }: { data: unknown }) {
  const d = data as BlockProps["stats"];

  return (
    <section className="py-12 md:py-16" aria-labelledby={d.title ? "stats-title" : undefined}>
      <div className="container mx-auto px-4 sm:px-6">
        {d.title && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 id="stats-title" className="section-title">{d.title}</h2>
          </motion.div>
        )}

        <motion.div
          className="flex gap-12 md:gap-16 justify-center flex-wrap"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8 }}
        >
          {d.items.map((stat, i) => (
            <div key={i} className="text-center">
              <span className="block text-3xl md:text-4xl font-semibold text-white tabular-nums">{stat.value}</span>
              <span className="block text-xs uppercase tracking-widest text-zinc-500 mt-2">{stat.label}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
