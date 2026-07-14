"use client";

import { motion } from "framer-motion";
import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Gallery — studio dark-premium image grid: optional eyebrow + section-title
 * header (matching AboutSection's "Про нас" pattern) over a responsive
 * 2/3-col grid of bordered, rounded tiles. Each tile fades/lifts in on
 * scroll; on hover a dark gradient overlay reveals the image's title +
 * uppercase category label, echoing the accent treatment used across the
 * studio template. Plain <img>, no next/image.
 */
export default function StudioGallery({ data }: { data: unknown }) {
  const d = data as BlockProps["gallery"];

  return (
    <section className="py-12 md:py-16" aria-labelledby={d.title ? "gallery-title" : undefined}>
      <div className="container mx-auto px-4 sm:px-6">
        {d.title && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <span className="inline-block text-xs font-medium tracking-widest uppercase text-[var(--color-accent)] mb-4">
              Галерея
            </span>
            <h2 id="gallery-title" className="section-title">{d.title}</h2>
          </motion.div>
        )}

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 max-w-6xl mx-auto">
          {d.images.map((img, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ delay: i * 0.06, duration: 0.5 }}
              className="group relative overflow-hidden rounded-lg border border-white/10 aspect-[4/3]"
            >
              <img
                src={img.url}
                alt={img.alt ?? img.title ?? ""}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
              />

              {(img.title || img.category) && (
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-400 flex flex-col justify-end p-5">
                  {img.title && (
                    <h3 className="text-white text-base font-semibold leading-snug">{img.title}</h3>
                  )}
                  {img.category && (
                    <p className="text-[var(--color-accent)] text-xs tracking-[0.2em] uppercase font-medium mt-1">
                      {img.category}
                    </p>
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
