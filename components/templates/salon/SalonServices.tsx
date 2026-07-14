"use client";

import { motion } from "framer-motion";
import type { BlockProps } from "@/lib/blocks/schema";
import { ScrollReveal } from "./ScrollReveal";
import { ServiceIcon } from "@/components/blocks/icons";

/*
 * Services — port of the source "Our Masterful Artistry & Care" grid: a
 * section-header (tag/title/description) followed by rounded glass cards
 * that lift on hover, each with an icon chip, serif name, description, and
 * price footer.
 *
 * Parameterised: fed by our `services` block. The source's category label,
 * "Explore" CTA, immersive background text, and the feature-highlights strip
 * (eco/stylists/appointments/drinks — hardcoded editorial copy, not block
 * data) have no schema equivalent and are dropped. lucide icons are swapped
 * for ServiceIcon(item.icon).
 */
export default function SalonServices({ data }: { data: unknown }) {
  const d = data as BlockProps["services"];

  return (
    <section className="py-16 sm:py-20 lg:py-24 bg-background dark:bg-black relative overflow-hidden transition-colors duration-1000">
      {/* Modern background accents */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-accent/10 rounded-full blur-[150px] mix-blend-multiply dark:mix-blend-screen pointer-events-none" />
      <div className="absolute top-1/2 left-0 w-[500px] h-[500px] bg-beauty-pink/5 rounded-full blur-[120px] mix-blend-multiply dark:mix-blend-overlay pointer-events-none" />

      <div className="section-container relative z-10">
        {d.title && (
          <ScrollReveal>
            <div className="section-header">
              <span className="section-tag">The Luxe Experience</span>
              <h2 className="section-title text-gradient-aurora">{d.title}</h2>
            </div>
          </ScrollReveal>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-10">
          {d.items.map((item, index) => (
            <ScrollReveal key={index} delay={index * 0.1}>
              <motion.div
                whileHover={{ y: -10 }}
                className="group relative h-full flex flex-col p-10 rounded-[3rem] bg-white/[0.02] dark:bg-zinc-900/40 border border-white/10 dark:border-white/[0.05] hover:border-accent/40 hover:bg-white/[0.05] dark:hover:bg-zinc-800/60 transition-all duration-700 backdrop-blur-3xl overflow-hidden shadow-elegant"
              >
                {/* Subtle Gradient Glow Background */}
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-accent/10 rounded-full blur-[60px] opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />

                {item.icon && (
                  <div className="relative z-10 mb-12 inline-flex w-fit p-4 rounded-2xl bg-accent/5 border border-accent/10 group-hover:bg-accent/10 group-hover:border-accent/30 transition-all duration-500 group-hover:animate-float">
                    <ServiceIcon
                      name={item.icon}
                      className="w-7 h-7 text-accent group-hover:scale-110 transition-transform duration-500"
                    />
                  </div>
                )}

                {/* Content */}
                <div className="space-y-4 relative z-10">
                  <h3 className="font-display text-3xl font-semibold text-foreground dark:text-white leading-tight">
                    {item.name}
                  </h3>
                  {item.description && (
                    <p className="text-muted-foreground font-light leading-relaxed text-lg line-clamp-3 group-hover:text-foreground/70 transition-colors duration-500">
                      {item.description}
                    </p>
                  )}
                </div>

                {/* Footer */}
                {item.price && (
                  <div className="mt-auto pt-12 relative z-10 space-y-1">
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground/70 font-bold">
                      Investment
                    </span>
                    <p className="font-display text-3xl font-bold tracking-tight text-accent">{item.price}</p>
                  </div>
                )}

                {/* Decorative corner accent */}
                <div className="absolute top-4 right-4 w-12 h-12 border-t border-r border-accent/0 group-hover:border-accent/20 rounded-tr-2xl transition-all duration-700" />
              </motion.div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
