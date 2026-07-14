import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Banner — a full-width statement band: a large glow-text pull-quote with a
 * serif-italic accent word, framed by a teal quote mark and a thin accent
 * rule, no button. Unlike PortfolioCTA (a glass card driving to action),
 * this section is a bare, full-bleed band that exists to break page rhythm
 * with a bold statement.
 */
export default function PortfolioBanner({ data }: { data: unknown }) {
  const d = data as BlockProps["cta"];
  const words = d.title.trim().split(" ");
  const lastWord = words.pop();
  const leadWords = words.join(" ");

  return (
    <section className="relative overflow-hidden py-20 sm:py-28" aria-labelledby="portfolio-banner-title">
      <div
        className="pointer-events-none absolute inset-0 -z-0"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--color-primary) 15%, transparent), transparent 70%)",
        }}
        aria-hidden="true"
      />

      <div className="container relative mx-auto px-6 text-center">
        <span className="font-serif text-6xl italic leading-none text-primary/30 sm:text-7xl" aria-hidden="true">
          &ldquo;
        </span>

        <h2
          id="portfolio-banner-title"
          className="glow-text animate-fade-in mx-auto mt-2 max-w-4xl text-3xl font-semibold leading-tight sm:text-4xl md:text-5xl"
        >
          {leadWords && <span>{leadWords} </span>}
          {lastWord && <span className="font-serif italic text-primary">{lastWord}</span>}
        </h2>

        <span className="mx-auto mt-8 block h-px w-16 bg-primary/50" aria-hidden="true" />

        {d.subtitle && (
          <p className="animate-fade-in animation-delay-100 mx-auto mt-8 max-w-xl text-base text-muted-foreground sm:text-lg">
            {d.subtitle}
          </p>
        )}
      </div>
    </section>
  );
}
