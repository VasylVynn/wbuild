import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Hero — the Launch signature: a big gradient headline over a radial GLOW, a
 * pill eyebrow, taupe subtitle and two CTAs (primary + glow-outline). §4.8:
 * images come ONLY from props — `d.imageUrl` renders in a framed glass "mockup"
 * card; without it the glow alone carries the section (never a broken <img>).
 *
 * Default: glow-centered (headline centred, optional framed image below).
 * `split` variant: text left, framed image / decorative glass panel right.
 */

function HeroButtons({ d }: { d: BlockProps["hero"] }) {
  if (!d.ctaLabel && !d.secondaryCtaLabel) return null;
  return (
    <div className="launch-appear-2 flex flex-col gap-3 sm:flex-row">
      {d.ctaLabel && (
        <a href={d.ctaHref ?? "#lead_form"} className="launch-btn launch-btn--primary">
          {d.ctaLabel}
        </a>
      )}
      {d.secondaryCtaLabel && (
        <a href={d.secondaryCtaHref ?? "#services"} className="launch-btn launch-btn--glow">
          {d.secondaryCtaLabel}
        </a>
      )}
    </div>
  );
}

function HeroMedia({ d, className = "" }: { d: BlockProps["hero"]; className?: string }) {
  if (d.imageUrl) {
    return (
      <div className={`launch-glass overflow-hidden rounded-2xl p-2 ${className}`} style={{ boxShadow: "var(--launch-shadow)" }}>
        <img src={d.imageUrl} alt={d.imageAlt ?? d.title} className="h-auto w-full rounded-xl object-cover" />
      </div>
    );
  }
  return (
    <div className={`launch-glass relative aspect-[4/3] overflow-hidden rounded-2xl ${className}`} style={{ boxShadow: "var(--launch-shadow)" }}>
      <div className="launch-glow launch-glow--center" aria-hidden="true" />
    </div>
  );
}

export default function LaunchHero({ data }: { data: unknown }) {
  const d = data as BlockProps["hero"];

  return (
    <section className="relative overflow-hidden px-4 pb-16 pt-20 sm:px-6 md:pt-28">
      <div className="launch-glow launch-glow--top" aria-hidden="true" />
      <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center gap-6 text-center">
        {d.eyebrow && <span className="launch-appear launch-badge launch-badge--brand">{d.eyebrow}</span>}
        <h1 className="launch-appear launch-gradient-text max-w-3xl text-balance text-4xl font-extrabold leading-tight sm:text-6xl md:text-7xl">
          {d.title}
          {d.titleAccent && <span className="text-[var(--launch-brand)]"> {d.titleAccent}</span>}
        </h1>
        {d.subtitle && (
          <p className="launch-appear-2 max-w-2xl text-balance text-base text-[var(--launch-muted)] sm:text-lg">
            {d.subtitle}
          </p>
        )}
        <HeroButtons d={d} />
        {d.imageUrl && (
          <div className="launch-appear-3 mt-8 w-full max-w-3xl">
            <HeroMedia d={d} />
          </div>
        )}
      </div>
    </section>
  );
}

export function LaunchHeroSplit({ data }: { data: unknown }) {
  const d = data as BlockProps["hero"];

  return (
    <section className="relative overflow-hidden px-4 py-20 sm:px-6 md:py-28">
      <div className="launch-glow launch-glow--top" aria-hidden="true" />
      <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
        <div className="text-center lg:text-left">
          {d.eyebrow && <span className="launch-appear launch-badge launch-badge--brand mb-5">{d.eyebrow}</span>}
          <h1 className="launch-appear launch-gradient-text mt-5 text-balance text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl">
            {d.title}
            {d.titleAccent && <span className="text-[var(--launch-brand)]"> {d.titleAccent}</span>}
          </h1>
          {d.subtitle && (
            <p className="launch-appear-2 mx-auto mt-6 max-w-xl text-base text-[var(--launch-muted)] sm:text-lg lg:mx-0">
              {d.subtitle}
            </p>
          )}
          <div className="mt-8 flex justify-center lg:justify-start">
            <HeroButtons d={d} />
          </div>
        </div>
        <HeroMedia d={d} className="launch-appear-3" />
      </div>
    </section>
  );
}
