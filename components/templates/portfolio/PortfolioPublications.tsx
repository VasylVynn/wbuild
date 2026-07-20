import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Publications — an index of works / press / cases (title · subtitle · year ·
 * source). Deliberately NOT the TIMELINE (no connector line, glowing dots or
 * glass panels) nor the GALLERY (no images): a lean ledger of hairline-divided
 * rows, each led by a serif index number, the title in serif turning teal on
 * hover, a muted subtitle, and the year (amber) + source tucked to the right.
 * Plain server component, no client state.
 */
export default function PortfolioPublications({ data }: { data: unknown }) {
  const d = data as BlockProps["publications"];

  return (
    <section
      className="py-16 sm:py-24"
      aria-labelledby={d.title ? "portfolio-publications-title" : undefined}
    >
      <div className="container mx-auto px-6">
        {d.title && (
          <div className="mx-auto mb-12 max-w-2xl text-center animate-fade-in sm:mb-16">
            <h2
              id="portfolio-publications-title"
              className="font-serif text-3xl font-bold sm:text-4xl md:text-5xl"
            >
              {d.title}
            </h2>
            <div className="mx-auto mt-5 h-px w-16 bg-highlight/60" />
          </div>
        )}

        <div className="mx-auto max-w-3xl border-t border-border">
          {d.items.map((item, i) => (
            <div
              key={i}
              className="group flex animate-fade-in items-baseline gap-5 border-b border-border px-2 py-6 transition-colors hover:bg-surface/40 sm:gap-8 sm:py-7"
              style={{ animationDelay: `${(i + 1) * 100}ms` }}
            >
              <span
                className="font-serif text-2xl leading-none tabular-nums text-primary/40 sm:text-3xl"
                aria-hidden="true"
              >
                {String(i + 1).padStart(2, "0")}
              </span>

              <div className="min-w-0 flex-1">
                <h3 className="font-serif text-lg font-semibold text-foreground transition-colors group-hover:text-primary sm:text-xl">
                  {item.title}
                </h3>
                {item.subtitle && (
                  <p className="mt-1 text-sm text-muted-foreground">{item.subtitle}</p>
                )}
              </div>

              {(item.year || item.source) && (
                <div className="shrink-0 text-right">
                  {item.year && <p className="text-sm font-medium text-highlight">{item.year}</p>}
                  {item.source && (
                    <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{item.source}</p>
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
