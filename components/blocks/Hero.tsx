import type { BlockProps } from "@/lib/blocks/schema";

/**
 * Hero — SKINS (layout variants of the SAME content, brief §3):
 *  - ""       classic: text column + optional image (the original layout).
 *  - "split"  two-column on md+; right side is the image, or a decorative
 *             accent panel bearing an oversized initial when no image exists.
 *  - "minimal" compact centred band: eyebrow + title + CTA, thin muted rule.
 * Only layout changes between skins — content/props are identical, so switching
 * is instant and safe. All skins keep the primary-on-primary hero identity and
 * use only tenant CSS vars.
 */

type HeroData = BlockProps["hero"];

function Eyebrow({ text }: { text: string }) {
  return (
    <p
      className="text-sm font-semibold uppercase tracking-widest"
      style={{ color: "var(--color-primary-foreground)", opacity: 0.75 }}
    >
      {text}
    </p>
  );
}

function Cta({ label, href }: { label: string; href?: string }) {
  return (
    <a
      href={href ?? "#"}
      className="inline-block rounded-[var(--radius)] px-8 py-4 text-lg font-semibold"
      style={{
        backgroundColor: "var(--color-background)",
        color: "var(--color-primary)",
      }}
    >
      {label}
    </a>
  );
}

// "" — the original classic layout, extracted unchanged.
function HeroDefault({ data }: { data: HeroData }) {
  const { eyebrow, title, subtitle, imageUrl, ctaLabel, ctaHref } = data;
  return (
    <section
      style={{
        backgroundColor: "var(--color-primary)",
        color: "var(--color-primary-foreground)",
      }}
    >
      <div className="mx-auto max-w-5xl px-4 py-16">
        <div className="flex flex-col gap-8 md:flex-row md:items-center">
          {/* Text column */}
          <div className="flex-1 space-y-6">
            {eyebrow && <Eyebrow text={eyebrow} />}

            <h1
              className="text-4xl font-bold leading-tight md:text-5xl"
              style={{ fontFamily: "var(--font-heading)", color: "var(--color-primary-foreground)" }}
            >
              {title}
            </h1>

            {subtitle && (
              <p
                className="text-xl leading-relaxed"
                style={{ color: "var(--color-primary-foreground)", opacity: 0.9 }}
              >
                {subtitle}
              </p>
            )}

            {ctaLabel && <Cta label={ctaLabel} href={ctaHref} />}
          </div>

          {/* Image column */}
          {imageUrl && (
            <div className="flex-1">
              <img
                src={imageUrl}
                alt=""
                loading="lazy"
                className="w-full rounded-[var(--radius)] object-cover"
                style={{ maxHeight: "480px" }}
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// "split" — text left, image/accent panel right; stacks on mobile.
function HeroSplit({ data }: { data: HeroData }) {
  const { eyebrow, title, subtitle, imageUrl, ctaLabel, ctaHref } = data;
  return (
    <section
      style={{
        backgroundColor: "var(--color-primary)",
        color: "var(--color-primary-foreground)",
      }}
    >
      <div className="mx-auto max-w-5xl px-4 py-16">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:items-center">
          {/* Text column (left-aligned) */}
          <div className="space-y-6 text-left">
            {eyebrow && <Eyebrow text={eyebrow} />}

            <h1
              className="text-4xl font-bold leading-tight md:text-5xl"
              style={{ fontFamily: "var(--font-heading)", color: "var(--color-primary-foreground)" }}
            >
              {title}
            </h1>

            {subtitle && (
              <p
                className="text-xl leading-relaxed"
                style={{ color: "var(--color-primary-foreground)", opacity: 0.9 }}
              >
                {subtitle}
              </p>
            )}

            {ctaLabel && <Cta label={ctaLabel} href={ctaHref} />}
          </div>

          {/* Accent column: image if present, else a decorative ornament panel. */}
          {imageUrl ? (
            <img
              src={imageUrl}
              alt=""
              loading="lazy"
              className="w-full rounded-[var(--radius)] object-cover"
              style={{ maxHeight: "480px" }}
            />
          ) : (
            <div
              aria-hidden
              className="flex items-center justify-center overflow-hidden rounded-[var(--radius)] p-8"
              style={{ backgroundColor: "var(--color-accent)", minHeight: "280px" }}
            >
              <span
                className="font-bold leading-none"
                style={{
                  fontFamily: "var(--font-heading)",
                  color: "var(--color-primary)",
                  opacity: 0.25,
                  fontSize: "12rem",
                }}
              >
                {title.charAt(0)}
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// "minimal" — compact centred band with a thin muted bottom rule.
function HeroMinimal({ data }: { data: HeroData }) {
  const { eyebrow, title, subtitle, ctaLabel, ctaHref } = data;
  return (
    <section
      style={{
        backgroundColor: "var(--color-primary)",
        color: "var(--color-primary-foreground)",
        borderBottom: "1px solid var(--color-muted)",
      }}
    >
      <div className="mx-auto max-w-3xl px-4 py-12 text-center">
        <div className="space-y-4">
          {eyebrow && <Eyebrow text={eyebrow} />}

          <h1
            className="text-3xl font-bold leading-tight md:text-4xl"
            style={{ fontFamily: "var(--font-heading)", color: "var(--color-primary-foreground)" }}
          >
            {title}
          </h1>

          {subtitle && (
            <p
              className="text-base leading-relaxed"
              style={{ color: "var(--color-primary-foreground)", opacity: 0.75 }}
            >
              {subtitle}
            </p>
          )}

          {ctaLabel && (
            <div className="pt-2">
              <Cta label={ctaLabel} href={ctaHref} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default function Hero({ data, skin }: { data: HeroData; skin?: string }) {
  if (skin === "split") return <HeroSplit data={data} />;
  if (skin === "minimal") return <HeroMinimal data={data} />;
  return <HeroDefault data={data} />;
}
