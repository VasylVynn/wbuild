import type { BlockProps } from "@/lib/blocks/schema";
import { Reveal } from "@/components/templates/shared/reveal";

/*
 * Gallery — real work of the space (§4.8: images come only from props). Each
 * tile reveals a soft caption (title / category) on hover. Two layouts:
 *
 * Default:  an even rounded grid.
 * `masonry`: a CSS-columns mosaic with natural-height tiles.
 */
type GalleryData = BlockProps["gallery"];
type Img = GalleryData["images"][number];

function Caption({ img }: { img: Img }) {
  if (!img.title && !img.category) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[rgba(41,36,31,0.72)] to-transparent p-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
      {img.title && <p className="text-sm font-semibold text-white">{img.title}</p>}
      {img.category && <p className="text-xs text-white/75">{img.category}</p>}
    </div>
  );
}

function Header({ title }: { title?: string }) {
  if (!title) return null;
  return (
    <Reveal className="mb-12 md:mb-16">
      <h2 className="beleza-kicker">
        <strong>{title}</strong> Трохи атмосфери й реальних робіт нашого простору.
      </h2>
    </Reveal>
  );
}

export default function BelezaGallery({ data }: { data: unknown }) {
  const d = data as GalleryData;

  return (
    <section id="gallery" className="beleza-section">
      <div className="beleza-container">
        <Header title={d.title} />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {d.images.map((img, i) => (
            <Reveal key={i} delay={i * 0.04}>
              <figure className="group relative overflow-hidden rounded-2xl">
                <img src={img.url} alt={img.alt ?? img.title ?? ""} className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                <Caption img={img} />
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function BelezaGalleryMasonry({ data }: { data: unknown }) {
  const d = data as GalleryData;

  return (
    <section id="gallery" className="beleza-section beleza-tint">
      <div className="beleza-container">
        <Header title={d.title} />
        <div className="gap-4 sm:columns-2 lg:columns-3">
          {d.images.map((img, i) => (
            <figure key={i} className="group relative mb-4 break-inside-avoid overflow-hidden rounded-2xl">
              <img src={img.url} alt={img.alt ?? img.title ?? ""} className="w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              <Caption img={img} />
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
