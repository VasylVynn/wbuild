"use client";

import { motion } from "framer-motion";
import type { BlockProps } from "@/lib/blocks/schema";
import { ServiceIcon } from "@/components/blocks/icons";

/*
 * Features (alt layout) — horizontal list rows instead of the default's 3-col
 * icon-card grid: each item is a full-width row (icon left, name+description
 * right) separated by hairline dividers, staggering in on scroll.
 */
export default function StudioFeaturesAlt({ data }: { data: unknown }) {
  const d = data as BlockProps["services"];

  return (
    <section className="py-12 md:py-16" aria-labelledby="features-alt-title">
      <div className="container mx-auto px-4 sm:px-6">
        {d.title && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 id="features-alt-title" className="section-title">{d.title}</h2>
          </motion.div>
        )}

        <div className="max-w-3xl mx-auto divide-y divide-white/5 border-t border-b border-white/5">
          {d.items.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ delay: i * 0.08, duration: 0.5 }}
              className="group flex items-start gap-5 py-6"
            >
              <div className="w-10 h-10 shrink-0 rounded-lg bg-white/5 flex items-center justify-center text-zinc-400 group-hover:text-[var(--color-accent)] transition-colors">
                {item.icon && <ServiceIcon name={item.icon} className="w-6 h-6" />}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">{item.name}</h3>
                {item.description && (
                  <p className="text-zinc-500 text-sm leading-relaxed">{item.description}</p>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
