import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Hero — port of the source react-2021 MainHero/MainHeroImage: left-aligned
 * text column (extrabold dark-ink title with a coral titleAccent line, gray
 * body copy, filled + outline coral CTAs) paired with a right-hand image
 * column (mirrors MainHeroImage's full-bleed photo; falls back to a
 * decorative coral gradient panel when the block has no imageUrl, per the
 * AiSaasHero image-vs-fallback contract). The source's canvas wave animation
 * is approximated with a wide (200%) two-tile gradient SVG pinned to the
 * hero's bottom edge, drifting via the `.tpl-react2021 .animate-wave-drift`
 * keyframe defined in globals.css.
 */
export default function React2021Hero({ data }: { data: unknown }) {
  const d = data as BlockProps["hero"];

  return (
    <section className="relative overflow-hidden bg-white pt-16 pb-24 md:pt-24 md:pb-32">
      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">
        <div className="text-center lg:text-left">
          {d.eyebrow && (
            <span className="mb-4 inline-block text-sm font-semibold uppercase tracking-wide text-[#ec4755]">
              {d.eyebrow}
            </span>
          )}

          <h1 className="text-4xl font-extrabold tracking-tight text-[#1a2e35] md:text-6xl">
            <span className="block">{d.title}</span>
            {d.titleAccent && <span className="block text-[#ec4755]">{d.titleAccent}</span>}
          </h1>

          {d.subtitle && (
            <p className="mx-auto mt-4 max-w-xl text-base text-gray-500 sm:text-lg md:text-xl lg:mx-0">
              {d.subtitle}
            </p>
          )}

          <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row lg:justify-start">
            {d.ctaLabel && (
              <a
                href={d.ctaHref ?? "#"}
                className="inline-flex items-center justify-center rounded-md bg-[#ec4755] px-8 py-3 font-medium text-white transition-colors hover:bg-[#a12c34]"
              >
                {d.ctaLabel}
              </a>
            )}

            {d.secondaryCtaLabel && (
              <a
                href={d.secondaryCtaHref ?? "#"}
                className="inline-flex items-center justify-center rounded-md border border-[#ec4755] bg-white px-8 py-3 font-medium text-[#a12c34] transition-colors hover:bg-[#ec4755] hover:text-white"
              >
                {d.secondaryCtaLabel}
              </a>
            )}
          </div>
        </div>

        <div className="relative">
          {d.imageUrl ? (
            <div
              className="overflow-hidden rounded-2xl shadow-xl"
              style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%, 6% 100%)" }}
            >
              <img
                src={d.imageUrl}
                alt={d.title}
                className="h-64 w-full object-cover sm:h-80 md:h-96 lg:h-[28rem]"
              />
            </div>
          ) : (
            <div
              className="aspect-4/3 w-full rounded-2xl bg-gradient-to-br from-[#ec4755] to-[#f9a8a8] shadow-xl"
              style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%, 6% 100%)" }}
            />
          )}
        </div>
      </div>

      {/* Decorative coral wave, slowly drifting via .animate-wave-drift */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 overflow-hidden leading-none" aria-hidden="true">
        <svg
          className="animate-wave-drift h-16 w-[200%] md:h-24"
          viewBox="0 0 2400 120"
          preserveAspectRatio="none"
          fill="none"
        >
          <defs>
            <linearGradient id="react2021-wave-gradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#ec4755" />
              <stop offset="100%" stopColor="#f9a8a8" />
            </linearGradient>
          </defs>
          <path
            d="M0,40 C150,90 350,0 600,40 C850,80 1050,0 1200,40 L1200,120 L0,120 Z"
            fill="url(#react2021-wave-gradient)"
            fillOpacity="0.18"
          />
          <path
            d="M1200,40 C1350,90 1550,0 1800,40 C2050,80 2250,0 2400,40 L2400,120 L1200,120 Z"
            fill="url(#react2021-wave-gradient)"
            fillOpacity="0.18"
          />
        </svg>
      </div>
    </section>
  );
}
