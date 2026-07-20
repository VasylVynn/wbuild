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
 *
 * Design-DNA wave 2 archetypes — STRUCTURALLY distinct shapes (not re-paddings
 * of the primary band above). Each has an honest no-photo state: a LIGHT,
 * CSS-only decor composition (accent/muted mesh + dot-grid), never a flat band
 * and never a fabricated image.
 *  - "photo-scrim"  full-bleed photo, bottom-up scrim, content bottom-LEFT in
 *                   light text. No photo → light decor bg, dark bottom-left copy.
 *  - "editorial"    typographic hero (imageUrl ignored BY DESIGN): light bg,
 *                   eyebrow chip, oversized clamp heading, narrow subtitle,
 *                   abstract accent shapes (no glyphs).
 *  - "split-light"  asymmetric light split: ~55% text left, photo right under a
 *                   radius mask. No photo → right becomes an accent decor panel.
 *  - "card-overlay" photo as section background, content in a light CARD offset
 *                   left. No photo → card sits on a soft accent mesh.
 *  - "visit-card"   light centred "business card": muted-bordered card with
 *                   corner accents; photo (if any) is a small media strip inside.
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

// Light, CSS-only decorative fill for honest no-photo states (§4.8): a soft
// accent/primary/muted mesh over the background plus a faint muted dot-grid.
// Fills its positioned parent, which owns the shape and any rounding/clip.
function DecorMesh() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 15% 12%, color-mix(in srgb, var(--color-accent) 26%, transparent) 0%, transparent 55%)," +
            "radial-gradient(120% 90% at 88% 22%, color-mix(in srgb, var(--color-primary) 16%, transparent) 0%, transparent 55%)," +
            "radial-gradient(150% 130% at 70% 108%, color-mix(in srgb, var(--color-muted) 65%, transparent) 0%, transparent 62%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle, color-mix(in srgb, var(--color-muted-foreground) 22%, transparent) 1.4px, transparent 1.5px)",
          backgroundSize: "22px 22px",
          opacity: 0.5,
        }}
      />
    </>
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
                alt={data.imageAlt ?? ""}
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
              alt={data.imageAlt ?? ""}
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
        alt={data.imageAlt ?? ""}
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

// "photo-scrim" — full-bleed photo with a bottom-up dark scrim; content anchored
// bottom-LEFT in light text. No photo → a LIGHT decor composition (mesh + dot
// grid) with the same bottom-left copy in dark text — never a primary band.
function HeroPhotoScrim({ data }: { data: HeroData }) {
  const { eyebrow, title, subtitle, imageUrl } = data;

  if (!imageUrl) {
    return (
      <section
        className="relative flex items-end overflow-hidden"
        style={{
          minHeight: "70vh",
          backgroundColor: "var(--color-background)",
          color: "var(--color-foreground)",
        }}
      >
        <DecorMesh />
        <div className="relative z-10 mx-auto w-full max-w-5xl px-4 py-16 md:py-20">
          <div className="max-w-2xl space-y-6">
            {eyebrow && <Eyebrow text={eyebrow} color="var(--color-primary)" />}
            <h1
              className="text-4xl font-bold leading-tight md:text-6xl"
              style={{ fontFamily: "var(--font-heading)", color: "var(--color-foreground)" }}
            >
              {title}
            </h1>
            {subtitle && (
              <p className="text-xl leading-relaxed" style={{ color: "var(--color-muted-foreground)" }}>
                {subtitle}
              </p>
            )}
            <CtaGroup data={data} onLight />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className="relative flex items-end overflow-hidden"
      style={{ minHeight: "80vh", backgroundColor: "var(--color-primary)" }}
    >
      <img
        src={imageUrl}
        alt={data.imageAlt ?? ""}
        aria-hidden
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover"
      />
      {/* Bottom-up scrim keeps the bottom-left copy legible over any photo. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.35) 42%, rgba(0,0,0,0) 78%)",
        }}
      />
      <div
        className="relative z-10 mx-auto w-full max-w-5xl px-4 py-16 md:py-20"
        style={{ color: "#ffffff" }}
      >
        <div className="max-w-2xl space-y-6">
          {eyebrow && <Eyebrow text={eyebrow} color="#ffffff" />}
          <h1
            className="text-4xl font-bold leading-tight md:text-6xl"
            style={{ fontFamily: "var(--font-heading)", color: "#ffffff" }}
          >
            {title}
          </h1>
          {subtitle && (
            <p className="max-w-2xl text-xl leading-relaxed" style={{ color: "#ffffff", opacity: 0.9 }}>
              {subtitle}
            </p>
          )}
          <CtaGroup data={data} />
        </div>
      </div>
    </section>
  );
}

// "editorial" — typographic hero, no photo BY DESIGN (imageUrl ignored): light
// bg, eyebrow chip, oversized clamp heading (optional accent tail), narrow
// subtitle column and abstract accent shapes. No-photo IS the design.
function HeroEditorial({ data }: { data: HeroData }) {
  const { eyebrow, title, titleAccent, subtitle } = data;
  return (
    <section
      className="relative overflow-hidden"
      style={{ backgroundColor: "var(--color-background)", color: "var(--color-foreground)" }}
    >
      {/* Abstract accent shapes only (no imagery, no initials): a translucent
          ring and a soft blob bleeding off two corners. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 hidden rounded-full md:block"
        style={{
          width: "22rem",
          height: "22rem",
          border: "1px solid color-mix(in srgb, var(--color-primary) 30%, transparent)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-24 rounded-full"
        style={{
          width: "26rem",
          height: "26rem",
          background:
            "radial-gradient(circle at center, color-mix(in srgb, var(--color-accent) 22%, transparent) 0%, transparent 70%)",
        }}
      />
      <div className="relative z-10 mx-auto max-w-5xl px-4 py-24 md:py-32">
        {eyebrow && (
          <span
            className="inline-block rounded-[var(--radius)] px-4 py-1.5 text-sm font-semibold uppercase tracking-widest"
            style={{ backgroundColor: "var(--color-muted)", color: "var(--color-muted-foreground)" }}
          >
            {eyebrow}
          </span>
        )}
        <h1
          className="mt-6 font-bold leading-[1.05]"
          style={{
            fontFamily: "var(--font-heading)",
            color: "var(--color-foreground)",
            fontSize: "clamp(2.75rem, 8vw, 5rem)",
          }}
        >
          {title}
          {titleAccent && <span style={{ color: "var(--color-primary)" }}> {titleAccent}</span>}
        </h1>
        {/* Thin accent rule under the headline. */}
        <div
          aria-hidden
          className="mt-8 h-px w-24"
          style={{ backgroundColor: "color-mix(in srgb, var(--color-primary) 55%, transparent)" }}
        />
        {subtitle && (
          <p className="mt-8 max-w-xl text-xl leading-relaxed" style={{ color: "var(--color-muted-foreground)" }}>
            {subtitle}
          </p>
        )}
        <div className="mt-10">
          <CtaGroup data={data} onLight />
        </div>
      </div>
    </section>
  );
}

// "split-light" — asymmetric split on a light bg: ~55% text column left, photo
// right under a var(--radius) mask. No photo → the right side becomes an accent
// decor panel (gradient + dot grid), never an empty box or a fake image.
function HeroSplitLight({ data }: { data: HeroData }) {
  const { eyebrow, title, titleAccent, subtitle, imageUrl } = data;
  return (
    <section style={{ backgroundColor: "var(--color-background)", color: "var(--color-foreground)" }}>
      <div className="mx-auto max-w-6xl px-4 py-16 md:py-20">
        <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-[11fr_9fr]">
          {/* Text column */}
          <div className="space-y-6">
            {eyebrow && <Eyebrow text={eyebrow} color="var(--color-primary)" />}
            <h1
              className="text-4xl font-bold leading-tight md:text-5xl lg:text-6xl"
              style={{ fontFamily: "var(--font-heading)", color: "var(--color-foreground)" }}
            >
              {title}
              {titleAccent && <span style={{ color: "var(--color-primary)" }}> {titleAccent}</span>}
            </h1>
            {subtitle && (
              <p className="max-w-xl text-xl leading-relaxed" style={{ color: "var(--color-muted-foreground)" }}>
                {subtitle}
              </p>
            )}
            <CtaGroup data={data} onLight />
          </div>

          {/* Media / decor column */}
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={data.imageAlt ?? ""}
              loading="lazy"
              className="w-full rounded-[var(--radius)] object-cover"
              style={{ maxHeight: "460px" }}
            />
          ) : (
            <div
              aria-hidden
              className="relative overflow-hidden rounded-[var(--radius)]"
              style={{
                minHeight: "320px",
                background:
                  "linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 32%, var(--color-background)) 0%, color-mix(in srgb, var(--color-primary) 22%, var(--color-background)) 100%)",
              }}
            >
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage:
                    "radial-gradient(circle, color-mix(in srgb, var(--color-foreground) 14%, transparent) 1.4px, transparent 1.5px)",
                  backgroundSize: "22px 22px",
                }}
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// "card-overlay" — photo as the section background with a light content CARD
// offset to the left. No photo → the card sits on a soft accent mesh instead of
// a photo, never a fabricated background image.
function HeroCardOverlay({ data }: { data: HeroData }) {
  const { eyebrow, title, subtitle, imageUrl } = data;
  return (
    <section
      className="relative flex items-center overflow-hidden"
      style={{ minHeight: "72vh", backgroundColor: "var(--color-muted)" }}
    >
      {imageUrl ? (
        <>
          <img
            src={imageUrl}
            alt={data.imageAlt ?? ""}
            aria-hidden
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
          {/* Light scrim only — the card carries legibility, not the photo. */}
          <div aria-hidden className="absolute inset-0" style={{ background: "rgba(0,0,0,0.18)" }} />
        </>
      ) : (
        <DecorMesh />
      )}
      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 py-16">
        <div
          className="max-w-md space-y-5 p-8 md:p-10"
          style={{
            backgroundColor: "var(--color-background)",
            color: "var(--color-foreground)",
            borderRadius: "var(--radius)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
          }}
        >
          {eyebrow && <Eyebrow text={eyebrow} color="var(--color-primary)" />}
          <h1
            className="text-3xl font-bold leading-tight md:text-4xl"
            style={{ fontFamily: "var(--font-heading)", color: "var(--color-foreground)" }}
          >
            {title}
          </h1>
          {subtitle && (
            <p className="text-lg leading-relaxed" style={{ color: "var(--color-muted-foreground)" }}>
              {subtitle}
            </p>
          )}
          <CtaGroup data={data} onLight />
        </div>
      </div>
    </section>
  );
}

// "visit-card" — a light, centred "business card": a muted-bordered card holds
// the eyebrow, title, subtitle and CTA pair, with small accent corner marks. It
// looks the same with or without a photo; a photo becomes a rounded media strip
// below the CTAs — never a full-bleed fake background.
function HeroVisitCard({ data }: { data: HeroData }) {
  const { eyebrow, title, subtitle, imageUrl } = data;
  return (
    <section
      style={{
        backgroundColor: "color-mix(in srgb, var(--color-muted) 55%, var(--color-background))",
        color: "var(--color-foreground)",
      }}
    >
      <div className="mx-auto max-w-2xl px-4 py-20 md:py-24">
        <div
          className="relative px-6 py-12 text-center md:px-12"
          style={{
            backgroundColor: "var(--color-background)",
            border: "1px solid var(--color-muted)",
            borderRadius: "var(--radius)",
            boxShadow: "0 18px 50px rgba(0,0,0,0.08)",
          }}
        >
          {/* Small accent corner brackets frame the card. */}
          <span
            aria-hidden
            className="absolute left-3 top-3 h-6 w-6"
            style={{ borderTop: "2px solid var(--color-accent)", borderLeft: "2px solid var(--color-accent)" }}
          />
          <span
            aria-hidden
            className="absolute bottom-3 right-3 h-6 w-6"
            style={{ borderBottom: "2px solid var(--color-accent)", borderRight: "2px solid var(--color-accent)" }}
          />

          <div className="space-y-6">
            {eyebrow && <Eyebrow text={eyebrow} color="var(--color-primary)" />}
            <h1
              className="text-3xl font-bold leading-tight md:text-5xl"
              style={{ fontFamily: "var(--font-heading)", color: "var(--color-foreground)" }}
            >
              {title}
            </h1>
            {subtitle && (
              <p className="mx-auto max-w-lg text-lg leading-relaxed" style={{ color: "var(--color-muted-foreground)" }}>
                {subtitle}
              </p>
            )}
          </div>

          <div className="mt-8 flex justify-center">
            <CtaGroup data={data} align="center" onLight />
          </div>

          {imageUrl && (
            <img
              src={imageUrl}
              alt={data.imageAlt ?? ""}
              loading="lazy"
              className="mt-8 w-full rounded-[var(--radius)] object-cover"
              style={{ maxHeight: "180px" }}
            />
          )}
        </div>
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
  if (skin === "photo-scrim") return <HeroPhotoScrim data={data} />;
  if (skin === "editorial") return <HeroEditorial data={data} />;
  if (skin === "split-light") return <HeroSplitLight data={data} />;
  if (skin === "card-overlay") return <HeroCardOverlay data={data} />;
  if (skin === "visit-card") return <HeroVisitCard data={data} />;
  return <HeroDefault data={data} />;
}
