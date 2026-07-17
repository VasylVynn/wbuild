import type { BlockProps } from "@/lib/blocks/schema";

/*
 * CTA — warm full-width terracotta band for the `cta` block. Cream canvas
 * around a rounded-3xl terracotta card so it reads as a hospitality "come
 * dine with us" banner; a white pill button carries the terracotta label,
 * mirroring AiSaasCTA's inline-arrow-SVG button but restyled for the warm
 * palette. Server component — no interaction needed.
 */
export default function RestaurantCTA({ data }: { data: unknown }) {
  const d = data as BlockProps["cta"];

  return (
    <section className="bg-[#FBF6EF] py-16 sm:py-20">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-[#C0562F] px-6 py-14 text-center md:px-16 md:py-16">
          <h2 className="mb-4 text-3xl font-bold text-white md:text-4xl">{d.title}</h2>

          {d.subtitle && (
            <p className="mx-auto mb-8 max-w-2xl text-lg text-white/85">{d.subtitle}</p>
          )}

          {d.buttonLabel && (
            <a
              href={d.buttonHref ?? "#"}
              className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3 font-semibold text-[#C0562F] transition hover:bg-[#FBF6EF]"
            >
              {d.buttonLabel}
              <svg
                className="h-[18px] w-[18px]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
