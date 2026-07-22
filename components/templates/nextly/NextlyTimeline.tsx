import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Timeline — nextly-styled vertical journey: a single hair-lined left rail
 * (gray-200 / neutral-700) with an indigo-600 node per milestone, each node's
 * ring punched in the page surface (white / gray-900) so it reads cleanly
 * through the rail. Reads chronologically off our `timeline` block (period →
 * indigo eyebrow, title, optional subtitle + description) — distinct from
 * services' feature grid. Header follows nextly's SectionTitle language. Plain
 * server component, no scroll animation (keeps it dependency-free).
 */
export default function NextlyTimeline({ data }: { data: unknown }) {
  const d = data as BlockProps["timeline"];

  return (
    <section className="w-full px-4 py-16 lg:py-20">
      <div className="mx-auto max-w-3xl">
        {d.title && (
          <div className="mx-auto mb-12 flex max-w-2xl flex-col items-center text-center">
            <span className="text-sm font-bold tracking-wider text-indigo-600 uppercase">
              Хронологія
            </span>
            <h2 className="mt-3 text-3xl font-bold leading-snug tracking-tight text-gray-800 lg:text-4xl lg:leading-tight dark:text-white">
              {d.title}
            </h2>
          </div>
        )}

        <div className="relative border-l border-gray-200 pl-8 dark:border-neutral-700 md:pl-10">
          {d.items.map((item, i) => (
            <div key={i} className="relative pb-10 last:pb-0">
              <span
                aria-hidden="true"
                className="absolute top-1.5 left-[-2rem] h-3 w-3 -translate-x-1/2 rounded-full bg-indigo-600 ring-4 ring-white dark:ring-gray-900 md:left-[-2.5rem]"
              />

              {item.period && (
                <span className="mb-1 block text-sm font-bold tracking-wider text-indigo-600 uppercase">
                  {item.period}
                </span>
              )}
              <h3 className="text-xl font-medium text-gray-800 dark:text-gray-200">
                {item.title}
              </h3>
              {item.subtitle && (
                <p className="mt-0.5 text-gray-600 dark:text-gray-400">{item.subtitle}</p>
              )}
              {item.description && (
                <p className="mt-2 leading-relaxed text-gray-500 dark:text-gray-400">
                  {item.description}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
