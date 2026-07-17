"use client";

import type { BlockProps } from "@/lib/blocks/schema";
import { Reveal } from "../shared/reveal";

/*
 * Team — studio-styled roster grid: centred header + a responsive grid of
 * `card` members that stagger in on scroll, matching FeaturesSection's motion.
 * Each member shows a photo when provided, otherwise a circular initials
 * badge in the accent color.
 */
function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export default function StudioTeam({ data }: { data: unknown }) {
  const d = data as BlockProps["team"];

  return (
    <section className="py-12 md:py-16" aria-labelledby="team-title">
      <div className="container mx-auto px-4 sm:px-6">
        {d.title && (
          <Reveal margin="-80px" className="text-center mb-16">
            <h2 id="team-title" className="section-title">{d.title}</h2>
          </Reveal>
        )}

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 max-w-6xl mx-auto">
          {d.items.map((item, i) => (
            <Reveal
              key={i}
              delay={i * 0.08}
              duration={0.5}
              margin="-80px"
              className="card text-center"
            >
              {item.photo ? (
                <img
                  src={item.photo}
                  alt={item.name}
                  className="w-20 h-20 rounded-full object-cover mx-auto mb-4"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-white/5 text-[var(--color-accent)] flex items-center justify-center mx-auto mb-4 text-lg font-semibold">
                  {initials(item.name)}
                </div>
              )}
              <h3 className="font-serif font-bold text-white mb-1">{item.name}</h3>
              {item.role && (
                <p className="text-[var(--color-accent)] text-sm mb-2">{item.role}</p>
              )}
              {item.bio && (
                <p className="text-zinc-500 text-sm leading-relaxed">{item.bio}</p>
              )}
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
