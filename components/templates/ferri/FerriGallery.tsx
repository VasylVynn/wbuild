"use client";

import type { BlockProps } from "@/lib/blocks/schema";
import { RevealStagger, RevealItem } from "./Reveal";
import { SectionHeading } from "./SectionHeading";
import { useLightbox } from "@/components/blocks/GalleryLightbox";

/*
 * Gallery — port of the source card-grid treatment (PUBLICAÇÕES/photo
 * styling): bordered image tiles that stagger in on scroll, sit slightly
 * desaturated at rest and sharpen + scale on hover.
 *
 * Parameterised: fed by our `gallery` block. Each image → one tile; when the
 * item carries a title or category, a bottom overlay bar shows a serif
 * caption and an uppercase gold category label — the source has no direct
 * equivalent for this, composed here from the ferri card/overlay DNA (see
 * the hero's name-tag overlay for the same pattern).
 */
export default function FerriGallery({ data }: { data: unknown }) {
  const d = data as BlockProps["gallery"];
  const { open, overlay } = useLightbox(d.images);

  return (
    <section className="border-t border-gold-500/8 py-14 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {d.title && <SectionHeading title={d.title} />}

        <RevealStagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {d.images.map((img, i) => (
            <RevealItem key={i}>
              <div className="group relative overflow-hidden border border-gold-500/12">
                <button
                  type="button"
                  onClick={() => open(i)}
                  aria-label={img.alt || img.title || "Переглянути фото"}
                  className="relative block w-full cursor-pointer text-left"
                >
                  <img
                    src={img.url}
                    alt={img.alt ?? img.title ?? ""}
                    className="h-64 w-full object-cover grayscale-[15%] transition-all duration-500 group-hover:grayscale-0 group-hover:scale-105"
                  />
                  {(img.title || img.category) && (
                    <div className="absolute inset-x-0 bottom-0 bg-navy-950/80 p-4 backdrop-blur-sm">
                      {img.title && (
                        <p className="font-[family-name:var(--ferri-display)] text-lg text-cream-100">
                          {img.title}
                        </p>
                      )}
                      {img.category && (
                        <p className="text-xs uppercase tracking-[2px] text-gold-500">{img.category}</p>
                      )}
                    </div>
                  )}
                </button>
              </div>
            </RevealItem>
          ))}
        </RevealStagger>
      </div>
      {overlay}
    </section>
  );
}
