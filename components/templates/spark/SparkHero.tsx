import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Hero — the source's signature landing intro. DEFAULT: two columns — a
 * mono-uppercase eyebrow, a medium (not bold) tracking-tight headline with an
 * optional muted titleAccent tail, a muted-foreground subtitle and a solid +
 * outline CTA pair on the left; a framed image on the right, or a quiet
 * token-tinted decorative panel when no photo is fed (§4.8 — never a broken box).
 */

function DecorPanel() {
  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--spark-radius)] border border-[var(--spark-border)] bg-[var(--spark-muted)]">
      <div className="absolute -left-10 -top-10 h-56 w-56 rounded-full bg-[var(--spark-fg)]/5 blur-3xl" />
      <div className="absolute -bottom-12 -right-8 h-64 w-64 rounded-full bg-[var(--spark-fg)]/5 blur-3xl" />
      <div
        className="absolute inset-0 opacity-[0.5]"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--spark-border) 1px, transparent 1px), linear-gradient(to bottom, var(--spark-border) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
    </div>
  );
}

function Ctas({ d, center }: { d: BlockProps["hero"]; center?: boolean }) {
  if (!d.ctaLabel && !d.secondaryCtaLabel) return null;
  return (
    <div className={`flex flex-col gap-3 pt-2 sm:flex-row ${center ? "justify-center" : ""}`}>
      {d.ctaLabel && (
        <a href={d.ctaHref ?? "#lead_form"} className="spark-btn spark-btn-primary">
          {d.ctaLabel}
        </a>
      )}
      {d.secondaryCtaLabel && (
        <a href={d.secondaryCtaHref ?? "#services"} className="spark-btn spark-btn-outline">
          {d.secondaryCtaLabel}
        </a>
      )}
    </div>
  );
}

export default function SparkHero({ data }: { data: unknown }) {
  const d = data as BlockProps["hero"];

  return (
    <section className="w-full bg-[var(--spark-bg)] px-4 py-16 sm:px-6 md:py-24 lg:px-8">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
        <div>
          {d.eyebrow && <p className="spark-eyebrow mb-4">{d.eyebrow}</p>}
          <h1 className="text-3xl leading-[1.1] text-[var(--spark-fg)] md:text-4xl lg:text-5xl">
            {d.title}
            {d.titleAccent && <span className="text-[var(--spark-muted-fg)]"> {d.titleAccent}</span>}
          </h1>
          {d.subtitle && (
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-[var(--spark-muted-fg)]">{d.subtitle}</p>
          )}
          <div className="mt-8">
            <Ctas d={d} />
          </div>
        </div>

        {d.imageUrl ? (
          <div className="overflow-hidden rounded-[var(--spark-radius)] border border-[var(--spark-border)] bg-[var(--spark-card)]">
            <img src={d.imageUrl} alt={d.imageAlt ?? d.title} className="aspect-[4/3] h-auto w-full object-cover" />
          </div>
        ) : (
          <DecorPanel />
        )}
      </div>
    </section>
  );
}

/*
 * Variant "centered" — a single centered column: eyebrow, oversized headline,
 * subtitle and centered CTAs, with the photo (when fed) spanning full width
 * below in a framed panel.
 */
export function SparkHeroCentered({ data }: { data: unknown }) {
  const d = data as BlockProps["hero"];

  return (
    <section className="w-full bg-[var(--spark-bg)] px-4 py-16 text-center sm:px-6 md:py-24 lg:px-8">
      <div className="mx-auto max-w-3xl">
        {d.eyebrow && <p className="spark-eyebrow mb-4">{d.eyebrow}</p>}
        <h1 className="text-4xl leading-[1.08] text-[var(--spark-fg)] md:text-5xl lg:text-6xl">
          {d.title}
          {d.titleAccent && <span className="text-[var(--spark-muted-fg)]"> {d.titleAccent}</span>}
        </h1>
        {d.subtitle && (
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[var(--spark-muted-fg)]">{d.subtitle}</p>
        )}
        <div className="mt-8">
          <Ctas d={d} center />
        </div>
      </div>

      {d.imageUrl && (
        <div className="mx-auto mt-14 max-w-5xl overflow-hidden rounded-[var(--spark-radius)] border border-[var(--spark-border)] bg-[var(--spark-card)]">
          <img src={d.imageUrl} alt={d.imageAlt ?? d.title} className="aspect-[16/9] h-auto w-full object-cover" />
        </div>
      )}
    </section>
  );
}
