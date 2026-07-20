import type { BlockProps } from "@/lib/blocks/schema";
/* eslint-disable @next/next/no-img-element -- tenant photos are plain <img> by design (§4.8 storage URLs, no next/image loader) */

/**
 * Hero — five Design-DNA wave 2 archetypes: STRUCTURALLY distinct shapes, each
 * with an honest no-photo state (a LIGHT, CSS-only decor composition — accent/
 * muted mesh + dot-grid — never a flat band and never a fabricated image).
 *
 * The six legacy "primary band" skins ("" classic, split, minimal, photo,
 * gradient, mesh) were removed per owner order 2026-07-20 (DNA-2c): the DB was
 * wiped, there is no production data, and those band looks are unsupported.
 *
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
 *
 * Fallback (no skin / unknown skin id / old stored ""): HeroEditorial when
 * there is no photo, HeroSplitLight when data.imageUrl exists — a sensible
 * default for both photo-poor and photo-rich content.
 *
 * Only layout changes between skins — content/props are identical, so switching
 * is instant and safe. Skins use tenant CSS vars for THEMED surfaces; white
 * text/scrims over REAL PHOTOS are content-driven constants, never platform
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
        loading="eager"
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
              loading="eager"
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
            loading="eager"
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
  if (skin === "photo-scrim") return <HeroPhotoScrim data={data} />;
  if (skin === "editorial") return <HeroEditorial data={data} />;
  if (skin === "split-light") return <HeroSplitLight data={data} />;
  if (skin === "card-overlay") return <HeroCardOverlay data={data} />;
  if (skin === "visit-card") return <HeroVisitCard data={data} />;
  // Fallback for no/unknown skin id (incl. old stored ""): editorial when the
  // content has no photo, split-light when a photo exists — a sensible default
  // for both photo-poor and photo-rich heroes now the legacy bands are gone.
  return data.imageUrl ? <HeroSplitLight data={data} /> : <HeroEditorial data={data} />;
}
