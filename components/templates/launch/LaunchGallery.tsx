import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Gallery — a grid of real photos (§4.8: every image is a props URL). Each tile
 * reveals an optional title/category caption on hover, over a brand-tinted
 * gradient scrim. Plain server component.
 */
export default function LaunchGallery({ data }: { data: unknown }) {
  const d = data as BlockProps["gallery"];

  return (
    <section className="relative px-4 py-20 sm:px-6 md:py-28">
      <div className="mx-auto max-w-6xl">
        {d.title && (
          <h2 className="launch-appear mx-auto mb-14 max-w-2xl text-balance text-center text-3xl font-bold sm:text-5xl">
            {d.title}
          </h2>
        )}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {d.images.map((img, i) => (
            <figure
              key={i}
              className="group launch-glass relative aspect-square overflow-hidden rounded-2xl p-1"
            >
              <img
                src={img.url}
                alt={img.alt ?? img.title ?? ""}
                className="h-full w-full rounded-xl object-cover transition-transform duration-500 group-hover:scale-105"
              />
              {(img.title || img.category) && (
                <figcaption className="pointer-events-none absolute inset-1 flex flex-col justify-end rounded-xl bg-gradient-to-t from-black/70 via-black/10 to-transparent p-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  {img.title && <span className="text-sm font-semibold text-white">{img.title}</span>}
                  {img.category && <span className="text-xs text-white/70">{img.category}</span>}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/*
 * Variant "masonry" — the same photos in a CSS-column masonry (varied heights)
 * instead of a square grid; the caption still reveals on hover.
 */
export function LaunchGalleryMasonry({ data }: { data: unknown }) {
  const d = data as BlockProps["gallery"];

  return (
    <section className="relative px-4 py-20 sm:px-6 md:py-28">
      <div className="mx-auto max-w-6xl">
        {d.title && (
          <h2 className="launch-appear mx-auto mb-14 max-w-2xl text-balance text-center text-3xl font-bold sm:text-5xl">
            {d.title}
          </h2>
        )}
        <div className="columns-2 gap-4 md:columns-3 [&>*]:mb-4">
          {d.images.map((img, i) => (
            <figure
              key={i}
              className="group launch-glass relative block break-inside-avoid overflow-hidden rounded-2xl p-1"
            >
              <img
                src={img.url}
                alt={img.alt ?? img.title ?? ""}
                className="w-full rounded-xl object-cover transition-transform duration-500 group-hover:scale-105"
              />
              {(img.title || img.category) && (
                <figcaption className="pointer-events-none absolute inset-1 flex flex-col justify-end rounded-xl bg-gradient-to-t from-black/70 via-black/10 to-transparent p-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  {img.title && <span className="text-sm font-semibold text-white">{img.title}</span>}
                  {img.category && <span className="text-xs text-white/70">{img.category}</span>}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
