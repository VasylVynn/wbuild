import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Hero — warm hospitality intro: terracotta eyebrow, big Lora serif headline
 * (with optional gold titleAccent tail), taupe subtitle, terracotta primary +
 * outline secondary CTA. Mirrors AiSaasHero's image-vs-fallback logic: a plain
 * <img> in a rounded warm frame when `d.imageUrl` is set, otherwise a
 * decorative cream→sand gradient panel with soft terracotta/olive blobs.
 */
export default function RestaurantHero({ data }: { data: unknown }) {
  const d = data as BlockProps["hero"];

  return (
    <section className="w-full bg-[#FBF6EF] px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2">
        <div className="text-center lg:text-left">
          {d.eyebrow && (
            <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#C0562F]">{d.eyebrow}</p>
          )}

          <h1 className="mb-4 text-4xl font-bold leading-tight text-[#2A2018] md:text-5xl lg:text-6xl">
            {d.title}
            {d.titleAccent && <span className="text-[#B7791F]"> {d.titleAccent}</span>}
          </h1>

          {d.subtitle && (
            <p className="mx-auto mb-8 max-w-xl text-lg text-[#6F6257] lg:mx-0">{d.subtitle}</p>
          )}

          <div className="flex flex-col justify-center gap-4 sm:flex-row lg:justify-start">
            {d.ctaLabel && (
              <a
                href={d.ctaHref ?? "#"}
                className="rounded-full bg-[#C0562F] px-7 py-3 font-medium text-white transition-colors hover:bg-[#9E4423]"
              >
                {d.ctaLabel}
              </a>
            )}

            {d.secondaryCtaLabel && (
              <a
                href={d.secondaryCtaHref ?? "#"}
                className="rounded-full border border-[#C0562F] px-7 py-3 font-medium text-[#C0562F] transition-colors hover:bg-[#C0562F] hover:text-white"
              >
                {d.secondaryCtaLabel}
              </a>
            )}
          </div>
        </div>

        {d.imageUrl ? (
          <div className="overflow-hidden rounded-3xl shadow-xl shadow-[#2A2018]/10">
            <img src={d.imageUrl} alt={d.imageAlt ?? d.title} className="h-auto w-full object-cover" />
          </div>
        ) : (
          <div className="relative aspect-4/3 overflow-hidden rounded-3xl bg-gradient-to-br from-[#FBF6EF] to-[#F3EADD] shadow-xl shadow-[#2A2018]/10">
            <div className="absolute -left-10 -top-10 h-56 w-56 rounded-full bg-[#C0562F]/20 blur-3xl" />
            <div className="absolute -bottom-12 -right-8 h-64 w-64 rounded-full bg-[#5F6F3E]/20 blur-3xl" />
            <div className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#B7791F]/10 blur-2xl" />
          </div>
        )}
      </div>
    </section>
  );
}
