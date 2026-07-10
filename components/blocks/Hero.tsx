import type { BlockProps } from "@/lib/blocks/schema";

/**
 * Hero — SKINS (layout variants of the SAME content, brief §3):
 *  - ""        classic: text column + optional image (the original layout).
 *  - "split"   two-column on md+; right side is the image, or a decorative
 *              accent panel bearing an oversized initial when no image exists.
 *  - "minimal" compact centred band: eyebrow + title + CTA, thin muted rule.
 *  - "photo"   full-bleed background photo + dark scrim, white centred text.
 *              Degrades to a primary band when no imageUrl is supplied.
 *  - "gradient" no-image band on a primary→darkened-primary linear gradient.
 *  - "mesh"    LIGHT band with soft blurred colour blobs drifting via CSS
 *              keyframes (reduced-motion aware); dark text on --color-background.
 * Only layout changes between skins — content/props are identical, so switching
 * is instant and safe. All skins use only tenant CSS vars, never platform
 * classes. Every skin supports an optional second (outline) CTA.
 */

type HeroData = BlockProps["hero"];

function Eyebrow({ text, color = "var(--color-primary-foreground)" }: { text: string; color?: string }) {
  return (
    <p
      className="text-sm font-semibold uppercase tracking-widest"
      style={{ color, opacity: 0.75 }}
    >
      {text}
    </p>
  );
}

// Primary CTA on a colored/dark surface — light pill with primary text.
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

// Primary CTA on a LIGHT surface (mesh) — primary-filled pill so it never
// vanishes into the page background the way the light `Cta` pill would.
function CtaSolid({ label, href }: { label: string; href?: string }) {
  return (
    <a
      href={href ?? "#"}
      className="inline-block rounded-[var(--radius)] px-8 py-4 text-lg font-semibold"
      style={{
        backgroundColor: "var(--color-primary)",
        color: "var(--color-primary-foreground)",
      }}
    >
      {label}
    </a>
  );
}

// Secondary (outline/ghost) CTA — transparent fill, hairline border in the
// inherited text color so it adapts to whatever surface it sits on.
function SecondaryCta({ label, href }: { label: string; href?: string }) {
  return (
    <a
      href={href ?? "#lead"}
      className="inline-block rounded-[var(--radius)] px-8 py-4 text-lg font-semibold"
      style={{
        backgroundColor: "transparent",
        color: "inherit",
        border: "1.5px solid currentColor",
      }}
    >
      {label}
    </a>
  );
}

/**
 * Renders the hero's call(s) to action.
 *  - No secondaryCtaLabel → emits the bare primary pill, byte-identical to the
 *    original `{ctaLabel && <Cta/>}` so existing skins stay pixel-perfect.
 *  - secondaryCtaLabel present → primary + outline pill in a wrapping flex row.
 * `onLight` swaps the primary pill for the filled variant (mesh); `align`
 * centres the two-button row for centred skins.
 */
function CtaGroup({
  data,
  onLight = false,
  align = "start",
}: {
  data: HeroData;
  onLight?: boolean;
  align?: "start" | "center";
}) {
  const { ctaLabel, ctaHref, secondaryCtaLabel, secondaryCtaHref } = data;
  const Primary = onLight ? CtaSolid : Cta;

  if (!ctaLabel && !secondaryCtaLabel) return null;

  if (!secondaryCtaLabel) {
    return ctaLabel ? <Primary label={ctaLabel} href={ctaHref} /> : null;
  }

  return (
    <div
      className={`flex flex-wrap items-center gap-4 ${
        align === "center" ? "justify-center" : "justify-start"
      }`}
    >
      {ctaLabel && <Primary label={ctaLabel} href={ctaHref} />}
      <SecondaryCta label={secondaryCtaLabel} href={secondaryCtaHref} />
    </div>
  );
}

// "" — the original classic layout, extracted unchanged.
function HeroDefault({ data }: { data: HeroData }) {
  const { eyebrow, title, subtitle, imageUrl } = data;
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

            <CtaGroup data={data} />
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
  const { eyebrow, title, subtitle, imageUrl } = data;
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

            <CtaGroup data={data} />
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
  const { eyebrow, title, subtitle } = data;
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

          {(data.ctaLabel || data.secondaryCtaLabel) && (
            <div className="pt-2">
              <CtaGroup data={data} align="center" />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// "photo" — full-bleed background photo behind a dark scrim, white centred text.
// No imageUrl → degrade to a primary band (never a broken empty box).
function HeroPhoto({ data }: { data: HeroData }) {
  const { eyebrow, title, subtitle, imageUrl } = data;

  if (!imageUrl) {
    return (
      <section
        style={{
          backgroundColor: "var(--color-primary)",
          color: "var(--color-primary-foreground)",
        }}
      >
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-4 py-24 text-center md:py-32">
          {eyebrow && <Eyebrow text={eyebrow} />}
          <h1
            className="text-4xl font-bold leading-tight md:text-6xl"
            style={{ fontFamily: "var(--font-heading)", color: "var(--color-primary-foreground)" }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              className="max-w-2xl text-xl leading-relaxed"
              style={{ color: "var(--color-primary-foreground)", opacity: 0.9 }}
            >
              {subtitle}
            </p>
          )}
          <CtaGroup data={data} align="center" />
        </div>
      </section>
    );
  }

  return (
    <section
      className="relative flex items-center justify-center overflow-hidden"
      style={{ minHeight: "78vh", backgroundColor: "var(--color-primary)" }}
    >
      <img
        src={imageUrl}
        alt=""
        aria-hidden
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover"
      />
      {/* Dark scrim so white copy stays legible over any photo. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.6) 100%)",
        }}
      />
      <div
        className="relative z-10 mx-auto flex max-w-4xl flex-col items-center gap-6 px-4 py-24 text-center"
        style={{ color: "#ffffff" }}
      >
        {eyebrow && <Eyebrow text={eyebrow} color="#ffffff" />}
        <h1
          className="text-5xl font-bold leading-tight md:text-6xl"
          style={{ fontFamily: "var(--font-heading)", color: "#ffffff" }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="max-w-2xl text-xl leading-relaxed" style={{ color: "#ffffff", opacity: 0.9 }}>
            {subtitle}
          </p>
        )}
        <CtaGroup data={data} align="center" />
      </div>
    </section>
  );
}

// "gradient" — no-image band on a primary → darkened-primary linear gradient.
function HeroGradient({ data }: { data: HeroData }) {
  const { eyebrow, title, subtitle } = data;
  return (
    <section
      style={{
        background:
          "linear-gradient(135deg, var(--color-primary) 0%, color-mix(in srgb, var(--color-primary) 62%, #000) 100%)",
        color: "var(--color-primary-foreground)",
      }}
    >
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-24 text-center md:py-32">
        {eyebrow && <Eyebrow text={eyebrow} />}
        <h1
          className="text-4xl font-bold leading-tight md:text-6xl"
          style={{ fontFamily: "var(--font-heading)", color: "var(--color-primary-foreground)" }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            className="max-w-2xl text-xl leading-relaxed"
            style={{ color: "var(--color-primary-foreground)", opacity: 0.9 }}
          >
            {subtitle}
          </p>
        )}
        <CtaGroup data={data} align="center" />
      </div>
    </section>
  );
}

// "mesh" — LIGHT band with soft blurred colour blobs drifting via CSS keyframes.
// Light-only adaptation of the design-template dark hero; motion is disabled
// under prefers-reduced-motion. Blob/keyframe names are `hero-mesh-` scoped.
function HeroMesh({ data }: { data: HeroData }) {
  const { eyebrow, title, subtitle } = data;
  return (
    <section
      className="relative overflow-hidden"
      style={{
        backgroundColor: "var(--color-background)",
        color: "var(--color-foreground)",
      }}
    >
      <style>{`
        .hero-mesh-blob {
          position: absolute;
          border-radius: 9999px;
          filter: blur(80px);
          will-change: transform;
          pointer-events: none;
        }
        .hero-mesh-a {
          width: 32rem; height: 32rem; top: -8rem; left: -6rem;
          background: radial-gradient(circle at center, color-mix(in srgb, var(--color-primary) 45%, transparent) 0%, transparent 70%);
          animation: hero-mesh-drift-a 22s ease-in-out infinite;
        }
        .hero-mesh-b {
          width: 28rem; height: 28rem; bottom: -10rem; right: -4rem;
          background: radial-gradient(circle at center, color-mix(in srgb, var(--color-accent) 42%, transparent) 0%, transparent 70%);
          animation: hero-mesh-drift-b 26s ease-in-out infinite;
        }
        .hero-mesh-c {
          width: 22rem; height: 22rem; top: 28%; left: 46%;
          background: radial-gradient(circle at center, color-mix(in srgb, var(--color-primary) 28%, transparent) 0%, transparent 70%);
          animation: hero-mesh-drift-c 30s ease-in-out infinite;
        }
        @keyframes hero-mesh-drift-a {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(8%, 6%); }
        }
        @keyframes hero-mesh-drift-b {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(-7%, -5%); }
        }
        @keyframes hero-mesh-drift-c {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(4%, -8%) scale(1.08); }
        }
        @media (prefers-reduced-motion: reduce) {
          .hero-mesh-blob { animation: none !important; }
        }
      `}</style>

      <div aria-hidden className="hero-mesh-blob hero-mesh-a" />
      <div aria-hidden className="hero-mesh-blob hero-mesh-b" />
      <div aria-hidden className="hero-mesh-blob hero-mesh-c" />

      <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-24 text-center md:py-32">
        {eyebrow && <Eyebrow text={eyebrow} color="var(--color-primary)" />}
        <h1
          className="text-4xl font-bold leading-tight md:text-6xl"
          style={{ fontFamily: "var(--font-heading)", color: "var(--color-foreground)" }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            className="max-w-2xl text-xl leading-relaxed"
            style={{ color: "var(--color-muted-foreground)" }}
          >
            {subtitle}
          </p>
        )}
        <CtaGroup data={data} align="center" onLight />
      </div>
    </section>
  );
}

export default function Hero({ data, skin }: { data: HeroData; skin?: string }) {
  if (skin === "split") return <HeroSplit data={data} />;
  if (skin === "minimal") return <HeroMinimal data={data} />;
  if (skin === "photo") return <HeroPhoto data={data} />;
  if (skin === "gradient") return <HeroGradient data={data} />;
  if (skin === "mesh") return <HeroMesh data={data} />;
  return <HeroDefault data={data} />;
}
