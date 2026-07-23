"use client";

import type { BlockProps } from "@/lib/blocks/schema";
import { PendingTile, pendingTileCount } from "./gallery-pending";
import { useLightbox } from "./GalleryLightbox";

/**
 * Gallery — SKINS (layout variants of the SAME content, brief §3):
 *  - ""          plain masonry image grid — the original layout.
 *  - "captions"  same masonry, but each tile is a hover group: the image scales
 *                up and a bottom gradient overlay reveals the image `title`
 *                (bold) + `category` (small uppercase). Tiles without a title
 *                stay plain — no empty overlay. Hover is pure CSS.
 */

type GalleryData = BlockProps["gallery"];

function SectionTitle({ title }: { title: string }) {
  return (
    <h2
      className="mb-12 text-3xl font-bold md:text-4xl"
      style={{ fontFamily: "var(--font-heading)", color: "var(--color-foreground)" }}
    >
      {title}
    </h2>
  );
}

// "" — the original plain masonry grid, extracted unchanged.
function GalleryDefault({ data }: { data: GalleryData }) {
  const { title, images } = data;
  const pending = pendingTileCount(images, data.pendingImages);
  const { open, overlay } = useLightbox(images);
  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      {title && <SectionTitle title={title} />}

      <ul className="columns-2 gap-4 space-y-4 md:columns-3">
        {images.map((image, index) => (
          <li key={index} className="break-inside-avoid">
            <button
              type="button"
              onClick={() => open(index)}
              aria-label={image.alt || image.title || "Переглянути фото"}
              className="block w-full cursor-pointer text-left"
            >
              <img
                src={image.url}
                alt={image.alt ?? ""}
                loading="lazy"
                className="w-full rounded-[var(--radius)] object-cover"
              />
            </button>
          </li>
        ))}
        {Array.from({ length: pending }, (_, i) => (
          <li key={`pending-${i}`} className="break-inside-avoid">
            <PendingTile className="aspect-[4/3] w-full rounded-[var(--radius)]" />
          </li>
        ))}
      </ul>
      {overlay}
    </div>
  );
}

// "captions" — hover-reveal title/category overlay over the same masonry grid.
function GalleryCaptions({ data }: { data: GalleryData }) {
  const { title, images } = data;
  const { open, overlay } = useLightbox(images);
  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      {title && <SectionTitle title={title} />}

      <ul className="columns-2 gap-4 space-y-4 md:columns-3">
        {images.map((image, index) => (
          <li
            key={index}
            className="group relative block break-inside-avoid overflow-hidden rounded-[var(--radius)]"
          >
            <button
              type="button"
              onClick={() => open(index)}
              aria-label={image.alt || image.title || "Переглянути фото"}
              className="relative block w-full cursor-pointer text-left"
            >
              <img
                src={image.url}
                alt={image.alt ?? ""}
                loading="lazy"
                className="w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              {image.title && (
                <div
                  className="absolute inset-x-0 bottom-0 flex flex-col gap-1 p-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  style={{
                    backgroundImage:
                      "linear-gradient(to top, color-mix(in srgb, var(--color-foreground) 80%, transparent), transparent)",
                  }}
                >
                  <span
                    className="font-bold leading-tight"
                    style={{ fontFamily: "var(--font-heading)", color: "var(--color-background)" }}
                  >
                    {image.title}
                  </span>
                  {image.category && (
                    <span
                      className="text-xs uppercase tracking-wider"
                      style={{ color: "var(--color-background)", opacity: 0.8 }}
                    >
                      {image.category}
                    </span>
                  )}
                </div>
              )}
            </button>
          </li>
        ))}
      </ul>
      {overlay}
    </div>
  );
}

export default function Gallery({
  data,
  skin,
}: {
  data: GalleryData;
  skin?: string;
}) {
  // Nothing to show and nothing being generated → no empty band.
  if (data.images.length === 0 && pendingTileCount(data.images, data.pendingImages) === 0) {
    return null;
  }
  return (
    <section
      style={{
        backgroundColor: "var(--color-accent)",
        color: "var(--color-foreground)",
      }}
    >
      {skin === "captions" ? (
        <GalleryCaptions data={data} />
      ) : (
        <GalleryDefault data={data} />
      )}
    </section>
  );
}
