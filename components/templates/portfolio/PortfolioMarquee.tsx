import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Marquee — full-bleed auto-scrolling strip of keywords (skills / tech). The
 * track holds the item list twice back-to-back so the -50% translateX loop
 * in animate-marquee (globals.css) is seamless; edge gradients fade the strip
 * into the section background. Duplicated track is decorative, so it's
 * hidden from assistive tech. Plain server component, no client state.
 */
export default function PortfolioMarquee({ data }: { data: unknown }) {
  const d = data as BlockProps["marquee"];

  return (
    <section className="py-16 sm:py-24">
      {d.title && (
        <p className="mb-8 px-6 text-center text-sm tracking-wide text-muted-foreground uppercase">
          {d.title}
        </p>
      )}

      <div className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-background to-transparent sm:w-32"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-background to-transparent sm:w-32"
          aria-hidden="true"
        />

        <div className="animate-marquee flex w-max items-center gap-10" aria-hidden="true">
          {[...d.items, ...d.items].map((item, i) => (
            <span key={i} className="flex flex-none items-center gap-10 whitespace-nowrap">
              <span className="text-xl font-semibold text-muted-foreground/50">{item}</span>
              <span className="h-1.5 w-1.5 flex-none rounded-full bg-primary" />
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
