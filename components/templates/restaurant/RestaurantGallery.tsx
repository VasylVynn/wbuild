import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Gallery — grid of dish/interior photos in the warm hospitality language:
 * rounded-2xl tiles with a soft warm shadow, zooming gently on hover and
 * revealing a terracotta caption overlay (title + category) sliding up from
 * the bottom, mirroring AiSaasGallery's structure. Plain server component —
 * the reveal is pure CSS (group-hover).
 */
export default function RestaurantGallery({ data }: { data: unknown }) {
  const d = data as BlockProps["gallery"];

  return (
    <section className="bg-[#F3EADD] py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {d.title && (
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <span className="text-sm font-semibold uppercase tracking-wide text-[#C0562F]">
              Галерея
            </span>
            <h2 className="mt-3 text-3xl font-bold text-[#2A2018] md:text-4xl">{d.title}</h2>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {d.images.map((img, i) => (
            <div
              key={i}
              className="group relative overflow-hidden rounded-2xl bg-white shadow-[0_10px_30px_-12px_rgba(42,32,24,0.35)] transition-shadow duration-300 hover:shadow-[0_16px_40px_-12px_rgba(42,32,24,0.45)]"
            >
              <img
                src={img.url}
                alt={img.alt ?? img.title ?? ""}
                className="h-64 w-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
              {(img.title || img.category) && (
                <div className="absolute inset-x-0 bottom-0 translate-y-full bg-[#C0562F]/90 p-4 backdrop-blur-sm transition-transform duration-300 group-hover:translate-y-0">
                  {img.title && <p className="text-sm font-bold text-white">{img.title}</p>}
                  {img.category && (
                    <span className="mt-1 inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white">
                      {img.category}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
