import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Gallery — port of the source Projects grid (Portfolio-Landing-Page-6):
 * glass image cards that zoom on hover, a bottom gradient wash, and a
 * hover-revealed overlay carrying the serif title, an amber category tag,
 * and a small corner arrow (the source's ArrowUpRight, now inline SVG since
 * lucide is out of scope). Plain server component, no client state.
 */
export default function PortfolioGallery({ data }: { data: unknown }) {
  const d = data as BlockProps["gallery"];

  return (
    <section className="py-16 sm:py-24" aria-labelledby="portfolio-gallery-title">
      <div className="container mx-auto px-6">
        {d.title && (
          <div className="mx-auto mb-12 max-w-2xl text-center animate-fade-in sm:mb-16">
            <span className="font-serif text-sm italic text-primary">Selected Work</span>
            <h2 id="portfolio-gallery-title" className="mt-3 text-3xl font-bold sm:text-4xl md:text-5xl">
              {d.title}
            </h2>
            <div className="mx-auto mt-5 h-px w-16 bg-highlight/60" />
          </div>
        )}

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {d.images.map((img, i) => (
            <div
              key={i}
              className="group animate-fade-in overflow-hidden rounded-2xl glass"
              style={{ animationDelay: `${(i + 1) * 100}ms` }}
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                <img
                  src={img.url}
                  alt={img.alt ?? img.title ?? ""}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-card via-card/50 to-transparent opacity-60" />

                {(img.title || img.category) && (
                  <div className="absolute inset-x-0 bottom-0 p-5 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    {img.category && (
                      <span className="inline-block rounded-full bg-highlight/15 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-highlight">
                        {img.category}
                      </span>
                    )}
                    {img.title && <p className="mt-2 font-serif text-lg font-semibold text-foreground">{img.title}</p>}
                  </div>
                )}

                <div className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full glass opacity-0 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:opacity-100">
                  <svg
                    className="h-4 w-4 text-primary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 17 17 7M7 7h10v10" />
                  </svg>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
