import type { BlockProps } from "@/lib/blocks/schema";

/*
 * CTA — react-2021 has no dedicated cta source component, so this reuses the
 * MainHero coral filled-button look as a full-width promo band: a solid
 * coral rounded-2xl panel with a subtle drifting white wave along its top
 * edge (same animate-wave-drift keyframe the hero's separator uses),
 * heading + subtext in white, and a light (white-on-coral) button that
 * inverts to dark-ink on hover. Field usage mirrors AiSaasCTA: title,
 * optional subtitle, buttonLabel, buttonHref guarded with a "#" fallback.
 */
export default function React2021CTA({ data }: { data: unknown }) {
  const d = data as BlockProps["cta"];

  return (
    <section className="bg-white py-12 sm:py-16">
      <div className="mx-auto max-w-5xl px-4">
        <div className="relative overflow-hidden rounded-2xl bg-[#ec4755] px-6 py-14 text-center text-white md:px-16 md:py-16">
          <svg
            className="animate-wave-drift pointer-events-none absolute inset-x-0 top-0 h-6 w-[200%]"
            viewBox="0 0 1200 40"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d="M0 20 Q150 0 300 20 T600 20 T900 20 T1200 20 V0 H0 Z"
              fill="rgba(255,255,255,0.12)"
            />
          </svg>

          <p className="text-3xl font-extrabold tracking-tight sm:text-4xl">{d.title}</p>

          {d.subtitle && (
            <p className="mx-auto mt-4 max-w-2xl text-lg text-white/80">{d.subtitle}</p>
          )}

          <div className="mt-8">
            <a
              href={d.buttonHref ?? "#"}
              className="inline-flex items-center justify-center rounded-md bg-white px-8 py-3 text-base font-medium text-[#ec4755] transition hover:bg-[#1a2e35] hover:text-white md:px-10 md:py-4 md:text-lg"
            >
              {d.buttonLabel}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
