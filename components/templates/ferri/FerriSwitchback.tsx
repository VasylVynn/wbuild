import type { BlockProps } from "@/lib/blocks/schema";
import { Reveal } from "./Reveal";
import { SectionHeading } from "./SectionHeading";

/*
 * Switchback — editorial "story" rows: a gold-framed photo paired with a prose
 * column, the pair mirroring left/right on each successive row so the page reads
 * as an alternating zig-zag. Distinct from the text-only About and the mosaic
 * Gallery — this is the business's process / behind-the-scenes narrative.
 * §4.8: the photo comes from props only (imageUrl may be blanked by the foreign-
 * image strip), so a row without one degrades to a centred full-width text card.
 * Composed from ferri's own idiom (SectionHeading + Reveal + gold hairlines) —
 * no external UI kit.
 */
export default function FerriSwitchback({ data }: { data: unknown }) {
  const d = data as BlockProps["switchback"];

  return (
    <section className="border-t border-gold-500/8 py-14 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {d.title && <SectionHeading title={d.title} />}

        <div className="space-y-16 sm:space-y-20 lg:space-y-28">
          {d.items.map((item, i) => {
            const flip = i % 2 === 1;
            const hasImage = Boolean(item.imageUrl);

            return (
              <Reveal key={i} y={40}>
                <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-16">
                  {hasImage && (
                    <div className={`relative ${flip ? "lg:order-2" : ""}`}>
                      <div className="group relative overflow-hidden border border-gold-500/12">
                        <img
                          src={item.imageUrl}
                          alt={item.heading}
                          className="h-72 w-full object-cover grayscale-[15%] transition-all duration-500 group-hover:scale-105 group-hover:grayscale-0 sm:h-96 lg:h-[30rem]"
                        />
                      </div>
                      <span
                        className={`absolute -bottom-3 h-16 w-px bg-gradient-to-b from-gold-500/50 to-transparent ${
                          flip ? "-left-3" : "-right-3"
                        }`}
                        aria-hidden="true"
                      />
                    </div>
                  )}

                  <div
                    className={`${flip ? "lg:order-1" : ""} ${
                      hasImage ? "" : "mx-auto max-w-3xl text-center"
                    }`}
                  >
                    <div
                      className={`flex items-center gap-3 ${hasImage ? "" : "justify-center"}`}
                      aria-hidden="true"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-gold-500" />
                      <span className="h-px w-14 bg-gradient-to-r from-gold-500/50 to-transparent" />
                    </div>

                    <h3 className="mt-6 font-[family-name:var(--ferri-display)] text-2xl leading-tight text-cream-100 sm:text-3xl md:text-4xl">
                      {item.heading}
                    </h3>
                    <p className="mt-5 text-base leading-relaxed text-txt-muted">{item.body}</p>

                    {item.buttonLabel && (
                      <a
                        href={item.buttonHref ?? "#contacts"}
                        className="group mt-7 inline-flex items-center gap-2 text-[13px] font-medium uppercase tracking-[2px] text-gold-500 transition-colors hover:text-gold-400"
                      >
                        {item.buttonLabel}
                        <svg
                          className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          aria-hidden="true"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </a>
                    )}
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
