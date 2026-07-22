"use client";

import type { BlockProps } from "@/lib/blocks/schema";
import { RevealStagger, RevealItem } from "./Reveal";
import { SectionHeading } from "./SectionHeading";

// Initials fallback — first letters of up to two name parts ("Олена Коваль" → "ОК").
function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/*
 * Team — the real people behind the business (partners, masters, experts).
 * Centred cards on a grid, each led by a circular portrait ringed in gold, or a
 * serif-monogram badge from the initials when no photo is grounded (§4.8 —
 * photos come only from props, and the section stays whole without them). A
 * serif name, an uppercase gold role, a hairline and a muted bio finish each
 * card. Distinct from Services (left-aligned icon cards for offerings): here
 * the subject is people, so the portrait leads and everything is centred.
 */
export default function FerriTeam({ data }: { data: unknown }) {
  const d = data as BlockProps["team"];

  return (
    <section className="border-t border-gold-500/8 py-14 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {d.title && <SectionHeading label="КОМАНДА" title={d.title} />}

        <RevealStagger className="grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
          {d.items.map((item, i) => (
            <RevealItem key={i}>
              <div className="flex h-full flex-col items-center border border-gold-500/8 bg-navy-800/30 p-8 text-center transition-colors hover:border-gold-500/20 sm:p-10">
                {item.photo ? (
                  <img
                    src={item.photo}
                    alt={item.name}
                    className="h-24 w-24 rounded-full object-cover grayscale-[15%] ring-1 ring-gold-500/40"
                  />
                ) : (
                  <div
                    className="flex h-24 w-24 items-center justify-center rounded-full bg-navy-900/60 font-[family-name:var(--ferri-display)] text-2xl text-gold-500 ring-1 ring-gold-500/30"
                    aria-hidden="true"
                  >
                    {initials(item.name)}
                  </div>
                )}

                <h3 className="mt-6 font-[family-name:var(--ferri-display)] text-xl text-cream-100">
                  {item.name}
                </h3>
                {item.role && (
                  <p className="mt-2 text-xs uppercase tracking-[2px] text-gold-500">{item.role}</p>
                )}
                <span className="mt-4 h-px w-8 bg-gold-500/40" aria-hidden="true" />
                {item.bio && (
                  <p className="mt-4 text-sm leading-relaxed text-txt-muted">{item.bio}</p>
                )}
              </div>
            </RevealItem>
          ))}
        </RevealStagger>
      </div>
    </section>
  );
}
