import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Gallery — react-2021 has no dedicated gallery source component, so this
 * reuses the coral design language from Features.tsx/Product.tsx: a centred
 * coral uppercase kicker + extrabold dark-ink heading above a responsive
 * grid of rounded-xl image cards. Each tile reveals a light caption bar
 * (title + coral category tag) sliding up on hover. Parameterised by our
 * `gallery` block — plain <img>, no next/image.
 */
export default function React2021Gallery({ data }: { data: unknown }) {
  const d = data as BlockProps["gallery"];

  return (
    <section className="bg-gray-50 py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="lg:text-center">
          <span className="text-sm font-semibold uppercase tracking-wide text-[#ec4755]">
            Галерея
          </span>
          {d.title && (
            <p className="mt-2 text-3xl font-extrabold tracking-tight text-[#1a2e35] sm:text-4xl">
              {d.title}
            </p>
          )}
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {d.images.map((img, i) => (
            <div
              key={i}
              className="group relative overflow-hidden rounded-xl bg-white shadow-sm transition-shadow duration-300 hover:shadow-lg"
            >
              <img
                src={img.url}
                alt={img.alt ?? img.title ?? ""}
                className="h-64 w-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
              {(img.title || img.category) && (
                <div className="absolute inset-x-0 bottom-0 translate-y-full bg-white/95 p-4 backdrop-blur-sm transition-transform duration-300 group-hover:translate-y-0">
                  {img.title && (
                    <p className="text-sm font-bold text-[#1a2e35]">{img.title}</p>
                  )}
                  {img.category && (
                    <span className="mt-1 inline-block rounded-full bg-[#ec4755]/10 px-3 py-1 text-xs font-semibold text-[#ec4755]">
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
