import type { BlockProps } from "@/lib/blocks/schema";

/*
 * CTA — port of nextly's Cta.tsx: a single filled indigo-600 card
 * (max-w-4xl, rounded-xl), heading + subtext on the left, a white
 * indigo-600 button on the right. Field usage mirrors AiSaasCTA
 * (title/subtitle/buttonLabel/buttonHref), button guarded on optional label.
 */
export default function NextlyCTA({ data }: { data: unknown }) {
  const d = data as BlockProps["cta"];

  return (
    <section className="bg-white py-16 dark:bg-neutral-900 lg:py-20">
      <div className="mx-auto max-w-4xl px-4">
        <div className="flex flex-wrap items-center justify-between gap-5 rounded-xl bg-indigo-600 px-7 py-7 text-white lg:flex-nowrap lg:px-12 lg:py-12">
          <div className="grow text-center lg:text-left">
            <h2 className="text-2xl font-medium lg:text-3xl">{d.title}</h2>
            {d.subtitle && (
              <p className="mt-2 font-medium text-white/90 lg:text-xl">{d.subtitle}</p>
            )}
          </div>

          {d.buttonLabel && (
            <div className="w-full shrink-0 text-center lg:w-auto">
              <a
                href={d.buttonHref ?? "#"}
                className="mx-auto inline-block rounded-md bg-white px-7 py-3 text-center text-lg font-medium text-indigo-600 lg:px-10 lg:py-5"
              >
                {d.buttonLabel}
              </a>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
