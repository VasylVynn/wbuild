import type { BlockProps } from "@/lib/blocks/schema";

/*
 * CTA — a centered glass band with a soft teal radial glow bleeding in behind
 * it, a glow-text title (serif italic accent on the last word), muted
 * subtitle and a pill button. Plain server component, no client state.
 */
export default function PortfolioCTA({ data }: { data: unknown }) {
  const d = data as BlockProps["cta"];
  const words = d.title.trim().split(" ");
  const lastWord = words.pop();
  const leadWords = words.join(" ");

  return (
    <section className="py-16 sm:py-24" aria-labelledby="portfolio-cta-title">
      <div className="container mx-auto px-6">
        <div className="relative max-w-4xl mx-auto glass-strong rounded-3xl px-6 py-16 sm:px-16 sm:py-20 text-center overflow-hidden">
          <div
            className="pointer-events-none absolute inset-0 -z-0"
            style={{
              background:
                "radial-gradient(circle at 50% 40%, color-mix(in srgb, var(--color-primary) 25%, transparent), transparent 70%)",
            }}
            aria-hidden="true"
          />

          <div className="relative animate-fade-in">
            <h2 id="portfolio-cta-title" className="text-3xl sm:text-5xl font-semibold glow-text">
              {leadWords && <span>{leadWords} </span>}
              {lastWord && <span className="font-serif italic text-primary">{lastWord}</span>}
            </h2>

            {d.subtitle && (
              <p className="mt-4 text-base sm:text-lg text-muted-foreground max-w-xl mx-auto">{d.subtitle}</p>
            )}

            <a
              href={d.buttonHref ?? "#"}
              className="mt-8 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 px-8 py-3.5 text-sm font-medium transition-transform hover:scale-105"
            >
              {d.buttonLabel}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
