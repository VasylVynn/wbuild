"use client";

import { motion } from "framer-motion";
import type { BlockProps } from "@/lib/blocks/schema";
import { Reveal, useRevealGate } from "../shared/reveal";

/*
 * Pricing (alt layout) — single bordered feature-table instead of the
 * default's separate price cards: every plan is one row (name · price ·
 * checklist), with the badge plan promoted via an accent left-border instead
 * of a floating pill. Per-plan CTA kept, same generic #contacts anchor as
 * the default (see PricingSection's FIDELITY-TODO — our schema carries no
 * per-item buttonHref).
 */
export default function StudioPricingAlt({ data }: { data: unknown }) {
  const d = data as BlockProps["services"];
  // Rows are semantic <article>s, so the shared <Reveal> div can't wrap them —
  // gate the reveal in place instead (H5): plain <article> until armed.
  const [listRef, armed] = useRevealGate<HTMLDivElement>();

  return (
    <section className="py-12 md:py-16" aria-labelledby="pricing-alt-title">
      <div className="container mx-auto px-4 sm:px-6">
        {d.title && (
          <Reveal margin="-80px" className="text-center mb-16">
            <h2 id="pricing-alt-title" className="section-title">{d.title}</h2>
          </Reveal>
        )}

        <div
          ref={listRef}
          className="max-w-3xl mx-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] divide-y divide-[var(--color-border)] overflow-hidden"
          role="list"
          aria-label="Тарифи"
        >
          {d.items.map((item, i) => {
            const promoted = Boolean(item.badge);
            const features = (item.description ?? "")
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean);

            const rowClass = `relative grid sm:grid-cols-[1fr_auto] gap-6 p-6 ${
              promoted ? "border-l-2 border-[var(--color-accent)] bg-white/[0.02]" : ""
            }`;

            const rowContent = (
              <>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-xl font-semibold text-white">{item.name}</h3>
                    {promoted && (
                      <span className="px-2.5 py-0.5 bg-[var(--color-accent)] text-white text-xs font-medium rounded-md">
                        {item.badge}
                      </span>
                    )}
                  </div>
                  {item.price && (
                    <div className="mb-4">
                      <span className="text-3xl font-bold text-white">{item.price}</span>
                    </div>
                  )}
                  {features.length > 0 && (
                    <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2" aria-label={`${item.name} — що входить`}>
                      {features.map((feature, j) => (
                        <li key={j} className="flex items-start gap-2.5 text-zinc-400 text-sm">
                          <svg className="w-4 h-4 text-zinc-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <a
                  href="#contacts"
                  className={`self-center shrink-0 px-6 py-3 rounded-md font-medium transition-all text-center text-sm ${
                    promoted
                      ? "btn-gradient"
                      : "bg-white/5 text-white hover:bg-white/10 border border-[var(--color-border)]"
                  }`}
                >
                  Замовити
                </a>
              </>
            );

            if (!armed) {
              return (
                <article key={i} role="listitem" className={rowClass} aria-label={item.name}>
                  {rowContent}
                </article>
              );
            }

            return (
              <motion.article
                key={i}
                role="listitem"
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ delay: i * 0.1, duration: 0.6 }}
                className={rowClass}
                aria-label={item.name}
              >
                {rowContent}
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
