import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Testimonials · variant "strip" — the base NextlyTestimonials is a 3-col grid
 * of centred cards; this is a single-column editorial strip. Each quote is a
 * full-width row (large indigo quotation mark marker in a left rail, quote +
 * inline author on the right), rows split by hairline dividers. Changes column
 * count (grid→list), density paradigm (cards→divided strip), alignment
 * (centred→left) and element order (marker leads). Light + dark.
 */
function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export default function NextlyTestimonialsStrip({ data }: { data: unknown }) {
  const d = data as BlockProps["testimonials"];

  return (
    <section className="w-full px-4 py-16 lg:py-20">
      <div className="mx-auto max-w-4xl">
        <div className="mb-10 flex flex-col">
          <span className="text-sm font-bold uppercase tracking-wider text-indigo-600">Відгуки</span>
          <h2 className="mt-3 text-3xl font-bold leading-snug tracking-tight text-gray-800 lg:text-4xl lg:leading-tight dark:text-white">
            {d.title ?? "Що кажуть клієнти"}
          </h2>
        </div>

        <ul className="divide-y divide-gray-200 dark:divide-neutral-800">
          {d.items.map((item, i) => (
            <li key={i} className="grid gap-4 py-8 first:pt-0 last:pb-0 sm:grid-cols-[auto_1fr] sm:gap-8">
              <div className="font-serif text-5xl leading-none text-indigo-300 dark:text-indigo-500" aria-hidden="true">
                “
              </div>
              <div>
                <p className="text-xl leading-relaxed text-gray-800 dark:text-gray-100">{item.quote}</p>
                <div className="mt-4 flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200">
                    {initials(item.author)}
                  </span>
                  <div className="text-sm">
                    <span className="font-medium text-gray-800 dark:text-white">{item.author}</span>
                    {item.role && <span className="text-gray-500 dark:text-gray-400"> · {item.role}</span>}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
