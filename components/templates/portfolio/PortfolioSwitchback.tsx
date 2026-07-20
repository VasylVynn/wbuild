import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Switchback — alternating image/text storytelling rows (zig-zag). Distinct
 * from the split HERO (top badge + CTAs) and the GALLERY grid: here every item
 * is a wide two-column row whose image swaps sides by index parity, the image
 * held in a glass card with a glow-border hover, the copy carrying a serif
 * heading, a short teal rule, muted body and an optional arrow link. §4.8 —
 * the image is prop-only and the row collapses to a centred text block when
 * absent. Plain server component, no client state.
 */
export default function PortfolioSwitchback({ data }: { data: unknown }) {
  const d = data as BlockProps["switchback"];

  return (
    <section
      className="py-16 sm:py-24"
      aria-labelledby={d.title ? "portfolio-switchback-title" : undefined}
    >
      <div className="container mx-auto px-6">
        {d.title && (
          <div className="mx-auto mb-12 max-w-2xl text-center animate-fade-in sm:mb-16">
            <h2
              id="portfolio-switchback-title"
              className="font-serif text-3xl font-bold sm:text-4xl md:text-5xl"
            >
              {d.title}
            </h2>
            <div className="mx-auto mt-5 h-px w-16 bg-highlight/60" />
          </div>
        )}

        <div className="space-y-16 sm:space-y-24">
          {d.items.map((item, i) => {
            const reversed = i % 2 === 1;

            return (
              <div
                key={i}
                className="grid animate-fade-in items-center gap-8 lg:grid-cols-2 lg:gap-14"
                style={{ animationDelay: `${(i + 1) * 100}ms` }}
              >
                {item.imageUrl && (
                  <div
                    className={`group relative overflow-hidden rounded-2xl glass ${
                      reversed ? "lg:order-2" : ""
                    }`}
                  >
                    <div
                      className="glow-border pointer-events-none absolute inset-0 z-10 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                      aria-hidden="true"
                    />
                    <div className="relative aspect-[4/3] overflow-hidden">
                      <img
                        src={item.imageUrl}
                        alt={item.heading}
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-card/60 to-transparent" />
                    </div>
                  </div>
                )}

                <div
                  className={
                    item.imageUrl
                      ? reversed
                        ? "lg:order-1"
                        : ""
                      : "mx-auto max-w-2xl text-center"
                  }
                >
                  <h3 className="font-serif text-2xl font-bold sm:text-3xl">{item.heading}</h3>
                  <div
                    className={`mt-4 h-px w-12 bg-primary/60 ${item.imageUrl ? "" : "mx-auto"}`}
                  />
                  <p className="mt-5 leading-relaxed text-muted-foreground">{item.body}</p>

                  {item.buttonLabel && (
                    <a
                      href={item.buttonHref ?? "#"}
                      className="group mt-6 inline-flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-highlight"
                    >
                      {item.buttonLabel}
                      <svg
                        className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                        aria-hidden="true"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
                      </svg>
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
