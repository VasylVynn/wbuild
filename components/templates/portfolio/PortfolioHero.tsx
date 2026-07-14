import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Fixed preset of background dot positions — the source computes these with
 * Math.random() at module load, which would produce a client/server mismatch
 * under SSR here. Same visual effect (~24 scattered dots, staggered drift
 * delay), just deterministic. Duration is shared; only left/top/delay vary.
 */
const DOTS: { left: string; top: string; delay: string }[] = [
  { left: "4%", top: "12%", delay: "0s" },
  { left: "12%", top: "38%", delay: "1.2s" },
  { left: "18%", top: "72%", delay: "2.4s" },
  { left: "26%", top: "18%", delay: "0.6s" },
  { left: "33%", top: "55%", delay: "3.1s" },
  { left: "41%", top: "84%", delay: "1.8s" },
  { left: "48%", top: "9%", delay: "2.9s" },
  { left: "55%", top: "47%", delay: "0.3s" },
  { left: "62%", top: "70%", delay: "3.6s" },
  { left: "69%", top: "24%", delay: "1.5s" },
  { left: "76%", top: "60%", delay: "2.1s" },
  { left: "83%", top: "15%", delay: "4.0s" },
  { left: "90%", top: "88%", delay: "0.9s" },
  { left: "8%", top: "92%", delay: "3.4s" },
  { left: "15%", top: "5%", delay: "1.1s" },
  { left: "22%", top: "63%", delay: "2.6s" },
  { left: "30%", top: "30%", delay: "0.5s" },
  { left: "38%", top: "78%", delay: "3.9s" },
  { left: "45%", top: "20%", delay: "1.7s" },
  { left: "58%", top: "88%", delay: "2.3s" },
  { left: "67%", top: "42%", delay: "0.8s" },
  { left: "74%", top: "10%", delay: "3.2s" },
  { left: "88%", top: "50%", delay: "1.4s" },
  { left: "95%", top: "25%", delay: "2.8s" },
];

/*
 * Hero — port of the source portfolio hero: full-viewport split layout with
 * a low-opacity background image (or a plain dark gradient when absent),
 * drifting teal dots, a glass eyebrow badge, a big headline with an optional
 * serif-italic accent line, description, and two rounded CTAs. Right column
 * is `d.imageUrl` reused as a glass/glow portrait card — dropped entirely
 * when no image. Source's social row, skills marquee, and hardcoded
 * "5+ years" badge are dropped (no schema data for them). Scroll hint links
 * to #about.
 */
export default function PortfolioHero({ data }: { data: unknown }) {
  const d = data as BlockProps["hero"];

  return (
    <section className="relative flex min-h-screen items-center overflow-hidden bg-background">
      {/* Bg */}
      <div className="absolute inset-0">
        {d.imageUrl ? (
          <>
            <img src={d.imageUrl} alt="" className="h-full w-full object-cover opacity-40" />
            <div className="absolute inset-0 bg-gradient-to-b from-background/20 via-background/80 to-background" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-surface via-background to-background" />
        )}
      </div>

      {/* Drifting dots */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {DOTS.map((dot, i) => (
          <div
            key={i}
            className="absolute h-1.5 w-1.5 rounded-full bg-primary opacity-60"
            style={{ left: dot.left, top: dot.top, animation: "portfolioDrift 20s ease-in-out infinite", animationDelay: dot.delay }}
          />
        ))}
      </div>

      {/* Content */}
      <div
        className={`container relative z-10 mx-auto grid items-center gap-12 px-6 pb-20 pt-32 ${
          d.imageUrl ? "lg:grid-cols-2" : ""
        }`}
      >
        <div className={`space-y-8 ${d.imageUrl ? "" : "max-w-2xl"}`}>
          {d.eyebrow && (
            <div className="animate-fade-in">
              <span className="inline-flex items-center gap-2 rounded-full glass px-4 py-2 text-sm text-primary">
                <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                {d.eyebrow}
              </span>
            </div>
          )}

          <div className="space-y-4">
            <h1 className="glow-text animate-fade-in animation-delay-100 text-4xl font-bold leading-tight text-foreground sm:text-5xl md:text-6xl lg:text-7xl">
              {d.title}
              {d.titleAccent && (
                <>
                  <br />
                  <span className="font-serif text-3xl italic font-normal sm:text-4xl md:text-5xl lg:text-6xl">
                    {d.titleAccent}
                  </span>
                </>
              )}
            </h1>
            {d.subtitle && (
              <p className="animate-fade-in animation-delay-200 max-w-lg text-lg text-muted-foreground">
                {d.subtitle}
              </p>
            )}
          </div>

          {(d.ctaLabel || d.secondaryCtaLabel) && (
            <div className="animate-fade-in animation-delay-300 flex flex-wrap gap-4">
              {d.ctaLabel && (
                <a
                  href={d.ctaHref ?? "#"}
                  className="group inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/25 transition-transform hover:scale-105"
                >
                  {d.ctaLabel}
                  <svg
                    className="h-4 w-4 transition-transform group-hover:translate-x-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </a>
              )}
              {d.secondaryCtaLabel && (
                <a
                  href={d.secondaryCtaHref ?? "#"}
                  className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-3 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  {d.secondaryCtaLabel}
                </a>
              )}
            </div>
          )}
        </div>

        {d.imageUrl && (
          <div className="animate-fade-in animation-delay-300 relative">
            <div className="relative mx-auto max-w-md">
              <div className="absolute inset-0 animate-pulse rounded-3xl bg-gradient-to-br from-primary/30 via-transparent to-primary/10 blur-2xl" />
              <div className="glass glow-border relative rounded-3xl p-2">
                <img src={d.imageUrl} alt={d.title} className="aspect-[4/5] w-full rounded-2xl object-cover" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Scroll hint */}
      <div className="animate-fade-in animation-delay-800 absolute bottom-8 left-1/2 z-10 -translate-x-1/2">
        <a href="#about" className="flex flex-col items-center gap-2 text-muted-foreground transition-colors hover:text-primary">
          <span className="text-xs uppercase tracking-wider">Scroll</span>
          <svg className="h-5 w-5 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </a>
      </div>
    </section>
  );
}
