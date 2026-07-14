import type { BlockProps } from "@/lib/blocks/schema";
import { Reveal } from "./Reveal";
import { SectionHeading } from "./SectionHeading";

/*
 * Stats — standalone number band, split out from the source hero's built-in
 * stats row (FerriHero drops it since this block owns it here). Same gold
 * tabular-nums value over an uppercase muted label, fading up on scroll via
 * Reveal. An optional title reuses SectionHeading (no label).
 */
export default function FerriStats({ data }: { data: unknown }) {
  const d = data as BlockProps["stats"];

  return (
    <section className="border-t border-gold-500/8 py-14 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {d.title && <SectionHeading title={d.title} />}

        <Reveal className="grid grid-cols-2 gap-6 border-t border-gold-500/10 pt-8 sm:grid-cols-4 sm:gap-8">
          {d.items.map((stat, i) => (
            <div key={i} className="text-center">
              <p className="text-2xl font-extralight tabular-nums tracking-tight text-gold-500 sm:text-3xl">
                {stat.value}
              </p>
              <p className="mt-1 text-[11px] uppercase tracking-[1.5px] text-txt-muted sm:text-xs">
                {stat.label}
              </p>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
