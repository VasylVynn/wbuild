import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Marquee — horizontally repeating strip of keyword items separated by a
 * coral star, sat on the dark-ink #1a2e35 band (same surface as the
 * Footer) for contrast against the mostly-white template. Mirrors
 * PortfolioMarquee's technique: the item list is duplicated back-to-back
 * and translated -50% so the loop is seamless, with edge gradients fading
 * the strip into the band. react2021 has no shared marquee keyframe in
 * globals.css, so the animation is scoped locally via an inline <style>
 * tag — keeps this component self-contained without touching global CSS.
 * Plain server component, no client state.
 */
export default function React2021Marquee({ data }: { data: unknown }) {
  const d = data as BlockProps["marquee"];

  return (
    <section className="bg-[#1a2e35] py-12 sm:py-16">
      {d.title && (
        <p className="mb-8 px-6 text-center text-sm font-semibold tracking-wide text-[#ec4755] uppercase">
          {d.title}
        </p>
      )}

      <div className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-[#1a2e35] to-transparent sm:w-32"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-[#1a2e35] to-transparent sm:w-32"
          aria-hidden="true"
        />

        <div
          className="react2021-marquee-track flex w-max items-center gap-10"
          aria-hidden="true"
        >
          {[...d.items, ...d.items].map((item, i) => (
            <span key={i} className="flex flex-none items-center gap-10 whitespace-nowrap">
              <span className="text-xl font-extrabold tracking-tight text-white/80">
                {item}
              </span>
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 flex-none text-[#ec4755]">
                <path d="M10 1l1.9 6.1L18 9l-6.1 1.9L10 17l-1.9-6.1L2 9l6.1-1.9L10 1z" />
              </svg>
            </span>
          ))}
        </div>
      </div>

      <style>{`
        .react2021-marquee-track {
          animation: react2021-marquee-scroll 26s linear infinite;
        }
        @keyframes react2021-marquee-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .react2021-marquee-track { animation: none; }
        }
      `}</style>
    </section>
  );
}
