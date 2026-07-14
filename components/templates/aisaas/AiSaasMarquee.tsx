import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Marquee — restyled port of PortfolioMarquee's technique for the aisaas
 * pastel palette: a pale lavender band, ink keyword text, coral dot
 * separators, edge-fading gradients, and the track duplicated 2x so a -50%
 * translateX loop is seamless. Reuses the existing `portfolioMarquee`
 * keyframe (defined unscoped in globals.css) via a Tailwind arbitrary
 * animation value, so no global CSS changes are needed. Plain server
 * component, no client state.
 */
export default function AiSaasMarquee({ data }: { data: unknown }) {
  const d = data as BlockProps["marquee"];

  return (
    <section className="bg-[#F1F0FB] py-14 sm:py-20">
      {d.title && (
        <p className="mb-8 px-6 text-center text-sm font-semibold tracking-wide text-[#E07A5F] uppercase">
          {d.title}
        </p>
      )}

      <div className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-[#F1F0FB] to-transparent sm:w-32"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-[#F1F0FB] to-transparent sm:w-32"
          aria-hidden="true"
        />

        <div
          className="flex w-max items-center gap-10 animate-[portfolioMarquee_30s_linear_infinite] motion-reduce:animate-none"
          aria-hidden="true"
        >
          {[...d.items, ...d.items].map((item, i) => (
            <span key={i} className="flex flex-none items-center gap-10 whitespace-nowrap">
              <span className="text-xl font-semibold text-[#2F4550]">{item}</span>
              <span className="h-1.5 w-1.5 flex-none rounded-full bg-[#E07A5F]" />
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
