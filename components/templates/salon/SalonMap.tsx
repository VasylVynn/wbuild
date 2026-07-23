"use client";

import type { BlockProps } from "@/lib/blocks/schema";
import { ScrollReveal } from "./ScrollReveal";

/*
 * Map — the `map` block in salon dress: the geocode-free Google embed framed
 * by a glass card (the template's signature surface), address line + gold pill
 * directions button underneath. Link behaviour matches components/blocks/
 * Map.tsx; the address itself is a grounded fact.
 */
export default function SalonMap({ data }: { data: unknown }) {
  const d = data as BlockProps["map"];
  const q = encodeURIComponent(d.address);

  return (
    <section className="relative overflow-hidden bg-background py-16 transition-colors duration-1000 dark:bg-black sm:py-20 lg:py-24">
      <div className="pointer-events-none absolute left-0 bottom-0 h-[500px] w-[500px] rounded-full bg-accent/10 blur-[140px] mix-blend-multiply dark:mix-blend-screen" />

      <div className="section-container relative z-10">
        {d.title && (
          <ScrollReveal>
            <div className="section-header">
              <span className="section-tag">Як нас знайти</span>
              <h2 className="section-title text-gradient-gold">{d.title}</h2>
            </div>
          </ScrollReveal>
        )}

        <ScrollReveal delay={0.15}>
          <div className="glass-card mx-auto max-w-4xl overflow-hidden !p-0">
            <iframe
              src={`https://www.google.com/maps?q=${q}&output=embed`}
              title={`Карта: ${d.address}`}
              className="h-72 w-full md:h-96"
              style={{ border: 0 }}
              loading="lazy"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
            />
            <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between md:p-8">
              <p className="text-base font-light text-muted-foreground">{d.address}</p>
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${q}`}
                target="_blank"
                rel="noopener"
                className="btn-gold-luxe inline-flex shrink-0 items-center justify-center rounded-full px-8 py-3 font-medium"
              >
                Прокласти маршрут
              </a>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
