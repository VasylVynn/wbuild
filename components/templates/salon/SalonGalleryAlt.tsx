"use client";

import { motion } from "framer-motion";
import type { BlockProps } from "@/lib/blocks/schema";
import { ScrollReveal } from "./ScrollReveal";

/*
 * Gallery (alt layout) — uniform rounded grid instead of the default's
 * varying-height masonry: equal-height tiles with a stronger hover zoom and
 * a gradient overlay caption. Same section-header and "View More" CTA.
 */
export default function SalonGalleryAlt({ data }: { data: unknown }) {
  const d = data as BlockProps["gallery"];

  return (
    <section className="py-16 sm:py-20 lg:py-24 bg-background dark:bg-black relative overflow-hidden transition-colors duration-500">
      <div className="absolute top-20 left-20 w-64 h-64 rounded-full bg-accent/5 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-40 right-20 w-80 h-80 rounded-full bg-beauty-pink/5 blur-[120px] pointer-events-none" />

      <div className="section-container relative z-10">
        {d.title && (
          <ScrollReveal>
            <div className="section-header">
              <span className="section-tag">Portfolio</span>
              <h2 className="section-title text-gradient-gold">{d.title}</h2>
            </div>
          </ScrollReveal>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {d.images.map((img, index) => (
            <ScrollReveal key={index} delay={index * 0.05}>
              <motion.div
                whileHover={{ scale: 1.03 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="group relative overflow-hidden rounded-3xl cursor-pointer aspect-square"
              >
                <img
                  src={img.url}
                  alt={img.alt ?? img.title ?? ""}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-125"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex flex-col justify-end p-6">
                  {(img.title || img.category) && (
                    <motion.div
                      initial={{ y: 16, opacity: 0 }}
                      whileHover={{ y: 0, opacity: 1 }}
                      transition={{ duration: 0.4 }}
                      className="space-y-1"
                    >
                      {img.title && (
                        <h3 className="font-display text-lg font-semibold text-white">{img.title}</h3>
                      )}
                      {img.category && (
                        <p className="text-accent text-[11px] tracking-[0.2em] uppercase font-medium">
                          {img.category}
                        </p>
                      )}
                    </motion.div>
                  )}
                </div>

                <div className="absolute inset-0 rounded-3xl ring-1 ring-inset ring-white/10 group-hover:ring-accent/40 transition-all duration-500 pointer-events-none" />
              </motion.div>
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal delay={0.6}>
          <div className="text-center mt-20">
            <motion.a
              href="#contact"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="inline-block glass text-foreground dark:text-white px-12 py-5 rounded-full font-medium text-lg hover:bg-accent/20 transition-all duration-500"
            >
              View More Work
            </motion.a>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
