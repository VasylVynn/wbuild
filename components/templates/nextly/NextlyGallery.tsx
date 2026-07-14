import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Gallery — nextly-style header (indigo eyebrow + bold heading) above a
 * responsive grid of rounded-2xl image tiles. Mirrors AiSaasGallery's
 * structure (grid + hover caption reveal) fed by our `gallery` block, in
 * nextly's clean indigo/gray surface language. Plain server component — the
 * reveal is pure CSS (group-hover), no client-only state needed.
 */
export default function NextlyGallery({ data }: { data: unknown }) {
  const d = data as BlockProps["gallery"];

  return (
    <section className="bg-white py-16 dark:bg-neutral-900 lg:py-20">
      <div className="mx-auto max-w-7xl px-4">
        {d.title && (
          <div className="mx-auto mb-12 flex max-w-2xl flex-col items-center text-center">
            <span className="text-sm font-bold tracking-wider text-indigo-600 uppercase">
              Галерея
            </span>
            <h2 className="mt-3 text-3xl font-bold leading-snug tracking-tight text-gray-800 lg:text-4xl lg:leading-tight dark:text-white">
              {d.title}
            </h2>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {d.images.map((img, i) => (
            <div
              key={i}
              className="group relative overflow-hidden rounded-2xl bg-gray-50 shadow-sm transition-shadow duration-300 hover:shadow-lg dark:bg-neutral-800"
            >
              <img
                src={img.url}
                alt={img.alt ?? img.title ?? ""}
                className="h-64 w-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
              {(img.title || img.category) && (
                <div className="absolute inset-x-0 bottom-0 translate-y-full bg-white/95 p-4 backdrop-blur-sm transition-transform duration-300 group-hover:translate-y-0 dark:bg-neutral-900/95">
                  {img.title && (
                    <p className="text-sm font-bold text-gray-800 dark:text-white">{img.title}</p>
                  )}
                  {img.category && (
                    <span className="mt-1 inline-block rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300">
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
