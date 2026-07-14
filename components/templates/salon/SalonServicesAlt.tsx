"use client";

import { motion } from "framer-motion";
import type { BlockProps } from "@/lib/blocks/schema";
import { ScrollReveal } from "./ScrollReveal";
import { ServiceIcon } from "@/components/blocks/icons";

/*
 * Services (alt layout) — alternating full-width rows instead of the
 * default's card grid: each service is a rounded glass row with an icon
 * chip on one side and name/description/price on the other, sides swapping
 * per row. Same section-header and hover-lift language as the default.
 */
export default function SalonServicesAlt({ data }: { data: unknown }) {
  const d = data as BlockProps["services"];

  return (
    <section className="py-16 sm:py-20 lg:py-24 bg-background dark:bg-black relative overflow-hidden transition-colors duration-1000">
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

        <div className="space-y-6 md:space-y-8">
          {d.items.map((item, index) => {
            const reversed = index % 2 === 1;
            return (
              <ScrollReveal key={index} delay={index * 0.1}>
                <motion.div
                  whileHover={{ y: -6 }}
                  className={`group flex flex-col sm:flex-row ${
                    reversed ? "sm:flex-row-reverse" : ""
                  } items-center gap-8 p-8 sm:p-10 rounded-[3rem] bg-white/[0.02] dark:bg-zinc-900/40 border border-white/10 dark:border-white/[0.05] hover:border-accent/40 hover:bg-white/[0.05] dark:hover:bg-zinc-800/60 transition-all duration-700 backdrop-blur-3xl overflow-hidden shadow-elegant`}
                >
                  {item.icon && (
                    <div className="relative z-10 shrink-0 inline-flex p-6 rounded-full bg-gradient-to-br from-accent/15 to-beauty-pink/10 border border-accent/10 group-hover:border-accent/30 transition-all duration-500 group-hover:animate-float">
                      <ServiceIcon
                        name={item.icon}
                        className="w-8 h-8 text-accent group-hover:scale-110 transition-transform duration-500"
                      />
                    </div>
                  )}

                  <div
                    className={`flex-1 space-y-3 text-center ${
                      reversed ? "sm:text-right" : "sm:text-left"
                    }`}
                  >
                    <h3 className="font-display text-2xl sm:text-3xl font-semibold text-foreground dark:text-white leading-tight">
                      {item.name}
                    </h3>
                    {item.description && (
                      <p className="text-muted-foreground font-light leading-relaxed text-lg group-hover:text-foreground/70 transition-colors duration-500">
                        {item.description}
                      </p>
                    )}
                    {item.price && (
                      <p className="font-display text-2xl font-bold tracking-tight text-accent pt-1">{item.price}</p>
                    )}
                  </div>
                </motion.div>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
