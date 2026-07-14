import type { BlockProps } from "@/lib/blocks/schema";
import { ServiceIcon } from "@/components/blocks/icons";

/*
 * Services — a centred eyebrow + serif-adjacent bold title above a grid of
 * glass cards, each with a teal icon chip, serif name, muted description and
 * a teal price line. The glow-border hover cue is an absolutely-positioned
 * overlay faded in via group-hover: Tailwind v4 only generates `hover:`
 * variants for classes it knows about, and the ready-made `glow-border` is
 * plain CSS on `.tpl-portfolio`, so `hover:glow-border` itself would be a
 * dead class. Plain server component, no client state.
 */
export default function PortfolioServices({ data }: { data: unknown }) {
  const d = data as BlockProps["services"];

  return (
    <section className="py-16 sm:py-24" aria-labelledby="portfolio-services-title">
      <div className="container mx-auto px-6">
        {d.title && (
          <div className="mx-auto mb-12 max-w-2xl text-center animate-fade-in sm:mb-16">
            <span className="font-serif text-sm italic text-primary">What I Offer</span>
            <h2 id="portfolio-services-title" className="mt-3 text-3xl font-bold sm:text-4xl md:text-5xl">
              {d.title}
            </h2>
            <div className="mx-auto mt-5 h-px w-16 bg-highlight/60" />
          </div>
        )}

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {d.items.map((item, i) => (
            <div
              key={i}
              className="group relative animate-fade-in rounded-2xl glass p-6 transition-transform duration-300 hover:-translate-y-1 sm:p-8"
              style={{ animationDelay: `${(i + 1) * 100}ms` }}
            >
              <div
                className="glow-border pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                aria-hidden="true"
              />
              <div className="relative">
                {item.icon && (
                  <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <ServiceIcon name={item.icon} className="h-6 w-6" />
                  </div>
                )}
                <h3 className="font-serif text-xl font-bold">{item.name}</h3>
                {item.description && (
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
                )}
                {item.price && <p className="mt-4 text-sm font-medium text-primary">{item.price}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
