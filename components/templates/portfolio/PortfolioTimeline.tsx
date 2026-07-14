import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Timeline — vertical journey/process list: a teal gradient line runs down
 * the left edge with a glowing dot per step, each row's glass panel carrying
 * period (teal), title (serif), subtitle (muted) and description. Plain
 * server component, no client state.
 */
export default function PortfolioTimeline({ data }: { data: unknown }) {
  const d = data as BlockProps["timeline"];

  return (
    <section className="py-16 sm:py-24" aria-labelledby={d.title ? "portfolio-timeline-title" : undefined}>
      <div className="container mx-auto px-6">
        {d.title && (
          <div className="mx-auto mb-12 max-w-2xl text-center animate-fade-in sm:mb-16">
            <h2 id="portfolio-timeline-title" className="font-serif text-3xl font-bold sm:text-4xl md:text-5xl">
              {d.title}
            </h2>
            <div className="mx-auto mt-5 h-px w-16 bg-highlight/60" />
          </div>
        )}

        <div className="relative mx-auto max-w-3xl">
          <div
            className="absolute top-2 bottom-2 left-[7px] w-px bg-gradient-to-b from-primary/50 via-primary/20 to-transparent"
            aria-hidden="true"
          />
          <div className="space-y-8">
            {d.items.map((item, i) => (
              <div
                key={i}
                className="relative flex gap-6 animate-fade-in"
                style={{ animationDelay: `${(i + 1) * 100}ms` }}
              >
                <span
                  className="timeline-glow relative z-10 mt-1.5 h-3.5 w-3.5 flex-none rounded-full bg-primary"
                  aria-hidden="true"
                />
                <div className="glass -mt-1 flex-1 rounded-2xl p-6 sm:p-7">
                  {item.period && (
                    <p className="text-sm font-medium tracking-wide text-primary">{item.period}</p>
                  )}
                  <h3 className="font-serif mt-1 text-xl font-bold sm:text-2xl">{item.title}</h3>
                  {item.subtitle && (
                    <p className="mt-1 text-sm text-muted-foreground">{item.subtitle}</p>
                  )}
                  {item.description && (
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
