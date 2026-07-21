import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Gallery — a clean image grid: hairline-framed tiles that lift on hover and
 * reveal a caption (title + category) sliding up from the bottom. Pure CSS
 * (group-hover), server component. Images always carry a url (schema).
 */
export default function SparkGallery({ data }: { data: unknown }) {
  const d = data as BlockProps["gallery"];

  return (
    <section id="gallery" className="bg-[var(--spark-bg)] px-4 py-16 sm:px-6 md:py-24 lg:px-8">
      <div className="mx-auto max-w-6xl">
        {d.title && (
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <p className="spark-eyebrow mb-3">Роботи</p>
            <h2 className="text-3xl text-[var(--spark-fg)] md:text-4xl">{d.title}</h2>
          </div>
        )}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {d.images.map((img, i) => (
            <div
              key={i}
              className="group relative overflow-hidden rounded-[var(--spark-radius)] border border-[var(--spark-border)] bg-[var(--spark-card)]"
            >
              <img
                src={img.url}
                alt={img.alt ?? img.title ?? ""}
                className="h-64 w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              {(img.title || img.category) && (
                <div className="absolute inset-x-0 bottom-0 translate-y-full bg-[var(--spark-bg)]/90 p-4 backdrop-blur-sm transition-transform duration-300 group-hover:translate-y-0">
                  {img.title && <p className="text-sm font-medium text-[var(--spark-fg)]">{img.title}</p>}
                  {img.category && (
                    <span className="spark-mono mt-1 inline-block text-xs uppercase tracking-wide text-[var(--spark-muted-fg)]">
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
