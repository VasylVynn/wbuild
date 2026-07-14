import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Hero — port of the nextly source Hero: two-column layout, bold headline
 * left, illustration right, collapsing to one column on mobile. The source's
 * hardcoded copy/CTAs are parameterised (eyebrow, title + optional
 * titleAccent, subtitle, primary + secondary CTA). No image field in the
 * schema is guaranteed populated, so the right panel falls back to a
 * decorative indigo gradient blob (mirrors the source's illustration slot)
 * when `d.imageUrl` is absent, exactly like AiSaasHero's image-vs-fallback
 * branch.
 */
export default function NextlyHero({ data }: { data: unknown }) {
  const d = data as BlockProps["hero"];

  return (
    <section className="w-full px-4 py-16">
      <div className="mx-auto flex max-w-7xl flex-wrap">
        <div className="flex w-full items-center lg:w-1/2">
          <div className="mb-8 max-w-2xl">
            {d.eyebrow && (
              <div className="mb-3 text-sm font-bold tracking-wider text-indigo-600 uppercase">
                {d.eyebrow}
              </div>
            )}

            <h1 className="text-4xl leading-snug font-bold tracking-tight text-gray-800 lg:text-4xl lg:leading-tight xl:text-6xl xl:leading-tight dark:text-white">
              {d.title}
              {d.titleAccent && <span className="text-indigo-600"> {d.titleAccent}</span>}
            </h1>

            {d.subtitle && (
              <p className="py-5 text-xl leading-normal text-gray-500 lg:text-xl xl:text-2xl dark:text-gray-300">
                {d.subtitle}
              </p>
            )}

            <div className="flex flex-col items-start space-y-3 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-4">
              {d.ctaLabel && (
                <a
                  href={d.ctaHref ?? "#"}
                  className="rounded-md bg-indigo-600 px-8 py-4 text-center text-lg font-medium text-white transition-colors hover:bg-indigo-500"
                >
                  {d.ctaLabel}
                </a>
              )}

              {d.secondaryCtaLabel && (
                <a
                  href={d.secondaryCtaHref ?? "#"}
                  className="flex items-center space-x-2 text-gray-500 dark:text-gray-400"
                >
                  <span>{d.secondaryCtaLabel}</span>
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="flex w-full items-center justify-center lg:w-1/2">
          {d.imageUrl ? (
            <img
              src={d.imageUrl}
              alt={d.title}
              className="w-full max-w-lg object-cover"
              loading="eager"
            />
          ) : (
            <div className="relative h-80 w-full max-w-lg overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-500 to-indigo-700">
              <div className="absolute -top-10 -left-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
              <div className="absolute -right-8 -bottom-8 h-48 w-48 rounded-full bg-indigo-300/30 blur-2xl" />
              <div className="absolute top-1/3 left-1/4 h-24 w-24 rounded-full bg-indigo-400/40 blur-xl" />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
