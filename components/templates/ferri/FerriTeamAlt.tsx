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
 * Team — list variant. An editorial roster: each person is a full-width row
 * with a circular portrait (or serif monogram) on the left and name / role /
 * bio on the right, rows split by ferri's hairline. A calmer, more formal
 * "наші люди" register than the default card grid, better for a short list of
 * partners/experts. Shares the default's §4.8 photo handling.
 */
export default function FerriTeamAlt({ data }: { data: unknown }) {
  const d = data as BlockProps["team"];

  return (
    <section className="border-t border-gold-500/8 py-14 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {d.title && <SectionHeading label="КОМАНДА" title={d.title} />}

        <RevealStagger className="mx-auto max-w-3xl divide-y divide-gold-500/10 border-y border-gold-500/10">
          {d.items.map((item, i) => (
            <RevealItem key={i}>
              <div className="flex items-center gap-6 py-6 sm:gap-8 sm:py-8">
                {item.photo ? (
                  <img
                    src={item.photo}
                    alt={item.name}
                    className="h-16 w-16 flex-none rounded-full object-cover grayscale-[15%] ring-1 ring-gold-500/40 sm:h-20 sm:w-20"
                  />
                ) : (
                  <div
                    className="flex h-16 w-16 flex-none items-center justify-center rounded-full bg-navy-800/50 font-[family-name:var(--ferri-display)] text-xl text-gold-500 ring-1 ring-gold-500/30 sm:h-20 sm:w-20 sm:text-2xl"
                    aria-hidden="true"
                  >
                    {initials(item.name)}
                  </div>
                )}

                <div className="min-w-0">
                  <h3 className="font-[family-name:var(--ferri-display)] text-xl text-cream-100 sm:text-2xl">
                    {item.name}
                  </h3>
                  {item.role && (
                    <p className="mt-1 text-xs uppercase tracking-[2px] text-gold-500">{item.role}</p>
                  )}
                  {item.bio && (
                    <p className="mt-2 text-sm leading-relaxed text-txt-muted">{item.bio}</p>
                  )}
                </div>
              </div>
            </RevealItem>
          ))}
        </RevealStagger>
      </div>
    </section>
  );
}
