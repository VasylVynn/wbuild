"use client";

import type { BlockProps } from "@/lib/blocks/schema";
import { RevealStagger, RevealItem } from "./Reveal";
import { SectionHeading } from "./SectionHeading";

/*
 * FerriGalleryAlt — alternate layout for the ferri gallery block. Where the
 * default is a uniform grid, this is a feature + strip layout: the first
 * image runs large on the left, the remaining images form a vertical
 * thumbnail column on the right (row on mobile). Same gold hairline frames
 * and hover treatment as the default.
 */
export default function FerriGalleryAlt({ data }: { data: unknown }) {
  const d = data as BlockProps["gallery"];
  const [feature, ...rest] = d.images;

  return (
    <section className="border-t border-gold-500/8 py-14 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {d.title && <SectionHeading title={d.title} />}

        {feature && (
          <RevealStagger className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <RevealItem>
              <div className="group relative overflow-hidden border border-gold-500/12">
                <img
                  src={feature.url}
                  alt={feature.alt ?? feature.title ?? ""}
                  className="h-80 w-full object-cover grayscale-[15%] transition-all duration-500 group-hover:grayscale-0 group-hover:scale-105 sm:h-[28rem] lg:h-full"
                />
                {(feature.title || feature.category) && (
                  <div className="absolute inset-x-0 bottom-0 bg-navy-950/80 p-5 backdrop-blur-sm">
                    {feature.title && (
                      <p className="font-[family-name:var(--ferri-display)] text-xl text-cream-100">
                        {feature.title}
                      </p>
                    )}
                    {feature.category && (
                      <p className="text-xs uppercase tracking-[2px] text-gold-500">{feature.category}</p>
                    )}
                  </div>
                )}
              </div>
            </RevealItem>

            {rest.length > 0 && (
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-1">
                {rest.map((img, i) => (
                  <RevealItem key={i}>
                    <div className="group relative overflow-hidden border border-gold-500/12">
                      <img
                        src={img.url}
                        alt={img.alt ?? img.title ?? ""}
                        className="h-32 w-full object-cover grayscale-[15%] transition-all duration-500 group-hover:grayscale-0 group-hover:scale-105 sm:h-40 lg:h-[9.5rem]"
                      />
                      {(img.title || img.category) && (
                        <div className="absolute inset-x-0 bottom-0 bg-navy-950/80 p-3 backdrop-blur-sm">
                          {img.title && (
                            <p className="font-[family-name:var(--ferri-display)] text-sm text-cream-100">
                              {img.title}
                            </p>
                          )}
                          {img.category && (
                            <p className="text-[10px] uppercase tracking-[1.5px] text-gold-500">{img.category}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </RevealItem>
                ))}
              </div>
            )}
          </RevealStagger>
        )}
      </div>
    </section>
  );
}
