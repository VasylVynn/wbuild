"use client";

import { motion } from "framer-motion";
import type { BlockProps } from "@/lib/blocks/schema";
import { PendingTile, pendingTileCount } from "@/components/blocks/gallery-pending";
import { ScrollReveal } from "./ScrollReveal";
import { useLightbox } from "@/components/blocks/GalleryLightbox";

/*
 * Gallery — port of the source "Transformations That Tell Stories" masonry:
 * a section-header followed by a 3-col grid of rounded image tiles with
 * varying heights, each revealing a gradient overlay + serif title/category
 * caption on hover.
 *
 * Parameterised: fed by our `gallery` block. Row-height variance and the
 * "View More" CTA are kept (CTA points at #contact per no on-page target).
 * next/image is swapped for a plain <img>.
 */
export default function SalonGallery({ data }: { data: unknown }) {
  const d = data as BlockProps["gallery"];
  const pending = pendingTileCount(d.images, d.pendingImages);
  const { open, overlay } = useLightbox(d.images);
  if (d.images.length === 0 && pending === 0) return null;

  return (
    <section className="py-16 sm:py-20 lg:py-24 bg-background dark:bg-black relative overflow-hidden transition-colors duration-500">
      {/* Background decorative elements */}
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

        {/* Asymmetrical masonry-style gallery */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {d.images.map((img, index) => (
            <ScrollReveal key={index} delay={index * 0.05}>
              <motion.div
                whileHover={{ y: -10 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className={`group relative overflow-hidden rounded-3xl cursor-pointer ${
                  index % 3 === 0 ? "h-[350px] md:h-[500px]" : index % 3 === 1 ? "h-[350px] md:h-[400px]" : "h-[350px] md:h-[450px]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => open(index)}
                  aria-label={img.alt || img.title || "Переглянути фото"}
                  className="absolute inset-0 block h-full w-full cursor-pointer text-left"
                >
                  <img
                    src={img.url}
                    alt={img.alt ?? img.title ?? ""}
                    className="h-full w-full object-cover transition-transform duration-1000 group-hover:scale-110"
                  />

                  {/* Elegant overlay */}
                  {(img.title || img.category) && (
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex flex-col justify-end p-8">
                      <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        whileHover={{ y: 0, opacity: 1 }}
                        transition={{ duration: 0.4 }}
                        className="space-y-1"
                      >
                        {img.title && (
                          <h3 className="font-display text-2xl font-semibold text-white">{img.title}</h3>
                        )}
                        {img.category && (
                          <p className="text-accent text-xs tracking-[0.2em] uppercase font-medium">
                            {img.category}
                          </p>
                        )}
                      </motion.div>
                    </div>
                  )}

                  {/* Corner detail */}
                  <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-2 group-hover:translate-y-0">
                    <div className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center bg-white/10 backdrop-blur-md">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </div>
                  </div>
                </button>
              </motion.div>
            </ScrollReveal>
          ))}
          {Array.from({ length: pending }, (_, i) => (
            <ScrollReveal key={`pending-${i}`} delay={i * 0.05}>
              <PendingTile
                className={`w-full rounded-3xl ${i % 3 === 0 ? "h-[350px] md:h-[500px]" : i % 3 === 1 ? "h-[350px] md:h-[400px]" : "h-[350px] md:h-[450px]"}`}
              />
            </ScrollReveal>
          ))}
        </div>
        {overlay}

        {/* Call to action */}
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
