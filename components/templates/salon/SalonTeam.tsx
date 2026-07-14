"use client";

import type { BlockProps } from "@/lib/blocks/schema";
import { ScrollReveal } from "./ScrollReveal";

// Initials fallback avatar — first letters of up to two name parts, e.g. "Олена Коваль" → "ОК".
function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

/*
 * Team — rounded glass cards on a responsive grid, each with a circular
 * gold-ringed photo (or a gradient initials badge when no photo is given),
 * a serif name, accent-colored role, and optional bio.
 */
export default function SalonTeam({ data }: { data: unknown }) {
  const d = data as BlockProps["team"];

  return (
    <section className="py-16 sm:py-20 lg:py-24">
      <div className="section-container">
        {d.title && (
          <ScrollReveal>
            <div className="section-header">
              <span className="section-tag">Наша команда</span>
              <h2 className="section-title text-gradient-gold">{d.title}</h2>
            </div>
          </ScrollReveal>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-10">
          {d.items.map((item, index) => (
            <ScrollReveal key={index} delay={index * 0.1}>
              <div className="card-glass h-full flex flex-col items-center text-center p-10 rounded-[3rem] hover:border-accent/40 transition-all duration-500">
                {item.photo ? (
                  <div className="mb-6 h-28 w-28 rounded-full p-1 bg-gradient-to-br from-accent via-gold-light to-beauty-pink shadow-gold">
                    <img
                      src={item.photo}
                      alt={item.name}
                      className="h-full w-full rounded-full object-cover border-2 border-background"
                    />
                  </div>
                ) : (
                  <div className="mb-6 flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-accent/15 to-beauty-pink/10 text-accent font-display text-3xl font-semibold">
                    {initials(item.name)}
                  </div>
                )}

                <h3 className="font-display text-2xl font-semibold text-foreground leading-tight">
                  {item.name}
                </h3>
                {item.role && (
                  <p className="mt-1 text-accent text-sm uppercase tracking-wider font-medium">
                    {item.role}
                  </p>
                )}
                {item.bio && (
                  <p className="mt-4 text-muted-foreground font-light leading-relaxed">
                    {item.bio}
                  </p>
                )}
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
