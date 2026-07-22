"use client";

import { motion } from "framer-motion";
import type { BlockProps } from "@/lib/blocks/schema";
import { ScrollReveal } from "./ScrollReveal";

/*
 * Switchback — editorial "story" rows: a large organic-cropped photo paired
 * with a prose column, the pair mirroring left/right on each successive row.
 * Distinct from the mosaic gallery and the text-only about — this is the
 * salon's before/after / behind-the-scenes narrative. §4.8: the photo comes
 * from props only; a row without one degrades to a centred full-width text card.
 */
export default function SalonSwitchback({ data }: { data: unknown }) {
  const d = data as BlockProps["switchback"];

  return (
    <section className="py-16 sm:py-20 lg:py-24 bg-background dark:bg-black relative overflow-hidden transition-colors duration-1000">
      <div className="absolute top-1/3 -left-32 w-[500px] h-[500px] bg-beauty-pink/5 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 -right-24 w-[520px] h-[520px] bg-accent/10 rounded-full blur-[150px] mix-blend-multiply dark:mix-blend-screen pointer-events-none" />

      <div className="section-container relative z-10">
        {d.title && (
          <ScrollReveal>
            <div className="section-header">
              <span className="section-tag">Наша історія</span>
              <h2 className="section-title text-gradient-gold">{d.title}</h2>
            </div>
          </ScrollReveal>
        )}

        <div className="space-y-elegant">
          {d.items.map((item, index) => {
            const flip = index % 2 === 1;
            const hasImage = Boolean(item.imageUrl);
            return (
              <ScrollReveal key={index} direction={flip ? "right" : "left"}>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
                  {hasImage && (
                    <motion.div
                      whileHover={{ y: -8 }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                      className={`relative ${flip ? "lg:order-2" : ""}`}
                    >
                      <div
                        className="absolute -inset-4 rounded-[3rem] bg-gradient-to-tr from-accent/15 to-beauty-pink/10 blur-2xl pointer-events-none"
                        aria-hidden="true"
                      />
                      <img
                        src={item.imageUrl}
                        alt={item.heading}
                        className="relative w-full h-[320px] sm:h-[420px] lg:h-[520px] object-cover shape-organic shadow-aurora"
                      />
                    </motion.div>
                  )}

                  <div
                    className={`space-y-6 ${flip ? "lg:order-1" : ""} ${
                      hasImage ? "" : "lg:col-span-2 max-w-3xl mx-auto text-center"
                    }`}
                  >
                    <div
                      className={`flex items-center gap-3 ${hasImage ? "" : "justify-center"}`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                      <span className="h-px w-14 bg-gradient-to-r from-accent to-transparent" />
                    </div>
                    <h3 className="font-display text-3xl sm:text-4xl font-semibold text-foreground dark:text-white leading-tight">
                      {item.heading}
                    </h3>
                    <p className="text-muted-foreground text-lg font-light leading-relaxed">
                      {item.body}
                    </p>
                    {item.buttonLabel && (
                      <a
                        href={item.buttonHref ?? "#contacts"}
                        className="btn-gold-luxe inline-flex items-center justify-center rounded-full px-9 py-3.5 font-medium"
                      >
                        {item.buttonLabel}
                      </a>
                    )}
                  </div>
                </div>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
