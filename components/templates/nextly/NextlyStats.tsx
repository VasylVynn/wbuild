import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Stats — nextly-styled number band: a soft gray-100 rounded-2xl panel
 * (mirrors the template's Testimonials.tsx card treatment) holding a
 * responsive grid of big bold indigo numbers over gray labels. Same data
 * usage as AiSaasStats (title + items[].value/label), no count-up
 * animation — schema values are already-formatted strings, not numbers
 * to tween.
 */
export default function NextlyStats({ data }: { data: unknown }) {
  const d = data as BlockProps["stats"];

  return (
    <section className="w-full px-4 py-16 lg:py-20">
      <div className="mx-auto max-w-7xl">
        <div className="rounded-2xl bg-gray-100 px-6 py-12 dark:bg-neutral-800 sm:px-10">
          {d.title && (
            <h2 className="mb-10 text-center text-3xl font-bold leading-snug tracking-tight text-gray-800 lg:text-4xl lg:leading-tight dark:text-white">
              {d.title}
            </h2>
          )}

          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {d.items.map((stat, i) => (
              <div key={i} className="text-center">
                <p className="text-4xl font-bold text-indigo-600 md:text-5xl">{stat.value}</p>
                <p className="mt-2 text-sm font-medium text-gray-600 dark:text-gray-400">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
