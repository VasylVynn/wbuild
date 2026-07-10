"use client";

import { motion } from "framer-motion";
import type { BlockProps } from "@/lib/blocks/schema";

/*
 * How it works — verbatim port of the source HowItWorksSection: centred header
 * over a set of numbered steps (01, 02, 03…) that stagger in on scroll.
 *
 * Parameterised: fed by our `services` block. Each item → one step (index →
 * zero-padded number, name → heading, description → body). Price/icon/badge are
 * ignored. The source's section subtitle has no field, so only the title shows.
 */
export default function HowItWorksSection({ data }: { data: unknown }) {
  const d = data as BlockProps["services"];

  return (
    <section className="py-20 md:py-28 relative" aria-labelledby="how-it-works-title">
      <div className="container mx-auto px-4 sm:px-6">
        {d.title && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 id="how-it-works-title" className="section-title">{d.title}</h2>
          </motion.div>
        )}

        <div className="grid md:grid-cols-3 gap-6 md:gap-8 max-w-4xl mx-auto">
          {d.items.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ delay: 0.1 + i * 0.15, duration: 0.5 }}
              className="text-center"
            >
              <span className="inline-block text-xs font-medium text-zinc-600 uppercase tracking-widest mb-4">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="text-lg font-semibold text-white mb-2">{item.name}</h3>
              {item.description && (
                <p className="text-zinc-500 text-sm leading-relaxed max-w-xs mx-auto">{item.description}</p>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
