"use client";

import type { BlockProps } from "@/lib/blocks/schema";
import { useLightbox } from "@/components/blocks/GalleryLightbox";

/*
 * Gallery — centred header (coral eyebrow + bold heading) above a responsive
 * grid of rounded-3xl image cards. Each tile zooms softly on hover and
 * reveals a light caption bar (title + pastel category tag) sliding up from
 * the bottom, matching the aisaas soft-pastel card language.
 *
 * Parameterised: fed by our `gallery` block. Plain server component — the
 * reveal is pure CSS (group-hover), no client-only state needed.
 */
export default function AiSaasGallery({ data }: { data: unknown }) {
  const d = data as BlockProps["gallery"];
  const { open, overlay } = useLightbox(d.images);

  return (
    <section className="bg-white py-16">
      <div className="mx-auto max-w-6xl px-4">
        {d.title && (
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <span className="mb-3 inline-block text-sm font-semibold text-[#E07A5F]">
              Галерея
            </span>
            <h2 className="text-3xl font-bold text-[#2F4550] md:text-4xl">{d.title}</h2>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {d.images.map((img, i) => (
            <div
              key={i}
              className="group relative overflow-hidden rounded-3xl bg-[#F1F0FB] shadow-sm transition-shadow duration-300 hover:shadow-lg"
            >
              <button
                type="button"
                onClick={() => open(i)}
                aria-label={img.alt || img.title || "Переглянути фото"}
                className="relative block w-full cursor-pointer text-left"
              >
                <img
                  src={img.url}
                  alt={img.alt ?? img.title ?? ""}
                  className="h-64 w-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                {(img.title || img.category) && (
                  <div className="absolute inset-x-0 bottom-0 translate-y-full bg-white/95 p-4 backdrop-blur-sm transition-transform duration-300 group-hover:translate-y-0">
                    {img.title && (
                      <p className="text-sm font-bold text-[#2F4550]">{img.title}</p>
                    )}
                    {img.category && (
                      <span className="mt-1 inline-block rounded-full bg-[#D3E4FD] px-3 py-1 text-xs font-semibold text-[#3D8690]">
                        {img.category}
                      </span>
                    )}
                  </div>
                )}
              </button>
            </div>
          ))}
        </div>
      </div>
      {overlay}
    </section>
  );
}
