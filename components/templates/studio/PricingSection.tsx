"use client";

import { motion } from "framer-motion";
import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Pricing — verbatim port of the source PricingSection: a grid of bordered
 * price cards that stagger in on scroll, with one card promoted (accent border
 * + floating "popular" pill + a checklist of features).
 *
 * Parameterised: fed by our `services` block. Per item → name, price (rendered
 * as-is, free-form e.g. "від 500 грн"), and the description split on "\n" into
 * a checklist (matching the source's feature list). An item with a `badge`
 * gets the promoted treatment and the badge text becomes the pill.
 *
 * Fidelity delta: the source's per-card CTA linked to a per-plan buttonHref
 * our schema doesn't carry; restored with a generic "Замовити" anchor to
 * #contacts (see FIDELITY-TODO below) instead of inventing per-item copy.
 */
export default function PricingSection({ data }: { data: unknown }) {
  const d = data as BlockProps["services"];

  return (
    <section className="py-12 md:py-16" aria-labelledby="pricing-title">
      <div className="container mx-auto px-4 sm:px-6">
        {d.title && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 id="pricing-title" className="section-title">{d.title}</h2>
          </motion.div>
        )}

        <div className="flex flex-wrap justify-center gap-4 max-w-6xl mx-auto" role="list" aria-label="Тарифи">
          {d.items.map((item, i) => {
            const promoted = Boolean(item.badge);
            const features = (item.description ?? "")
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean);

            return (
              <motion.article
                key={i}
                role="listitem"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ delay: i * 0.1, duration: 0.6 }}
                className={`relative rounded-lg p-6 w-full sm:w-[264px] ${
                  promoted
                    ? "bg-[var(--color-surface)] border-2 border-[var(--color-accent)]"
                    : "bg-[var(--color-surface)] border border-[var(--color-border)]"
                }`}
                aria-label={item.name}
              >
                {promoted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-3 py-1 bg-[var(--color-accent)] text-white text-xs font-medium rounded-md">
                      {item.badge}
                    </span>
                  </div>
                )}

                <h3 className="text-xl font-semibold text-white mb-1">{item.name}</h3>

                {item.price && (
                  <div className="mb-6 mt-4">
                    <span className="text-4xl font-bold text-white">{item.price}</span>
                  </div>
                )}

                {features.length > 0 && (
                  <ul className="space-y-3 mb-6" aria-label={`${item.name} — що входить`}>
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

                {/* FIDELITY-TODO: needs schema field services.items[].buttonLabel / buttonHref — fallback used */}
                <a
                  href="#contacts"
                  className={`block w-full py-3 rounded-md font-medium transition-all text-center text-sm ${
                    promoted
                      ? "btn-gradient"
                      : "bg-white/5 text-white hover:bg-white/10 border border-[var(--color-border)]"
                  }`}
                >
                  Замовити
                </a>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
