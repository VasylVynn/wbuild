import type { BlockProps } from "@/lib/blocks/schema";
import { ServiceIcon } from "@/components/blocks/icons";

/*
 * Services — port of nextly's Benefits.tsx "benefit" pattern: an indigo icon
 * chip (w-11 h-11 bg-indigo-500 rounded-md, white/indigo-50 icon) beside a
 * bold title + gray description, reused here as a responsive card grid fed
 * by our `services` block (icon/name/description/price/badge). Header
 * follows nextly's SectionTitle language (indigo eyebrow + bold heading).
 * Plain server component — no client-only interaction in this section.
 */
export default function NextlyServices({ data }: { data: unknown }) {
  const d = data as BlockProps["services"];

  return (
    <section className="bg-white py-16 dark:bg-neutral-900 lg:py-20">
      <div className="mx-auto max-w-7xl px-4">
        {d.title && (
          <div className="mx-auto mb-12 flex max-w-2xl flex-col items-center text-center">
            <span className="text-sm font-bold tracking-wider text-indigo-600 uppercase">
              Наші послуги
            </span>
            <h2 className="mt-3 text-3xl font-bold leading-snug tracking-tight text-gray-800 lg:text-4xl lg:leading-tight dark:text-white">
              {d.title}
            </h2>
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {d.items.map((item, i) => (
            <div
              key={i}
              className="relative rounded-2xl bg-gray-50 p-6 transition-shadow duration-300 hover:shadow-lg dark:bg-neutral-800 sm:p-8"
            >
              {item.badge && (
                <span className="absolute top-5 right-5 rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300">
                  {item.badge}
                </span>
              )}

              {item.icon && (
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-md bg-indigo-500">
                  <ServiceIcon name={item.icon} className="h-7 w-7 text-indigo-50" />
                </div>
              )}

              <h4 className="text-xl font-medium text-gray-800 dark:text-gray-200">
                {item.name}
              </h4>
              {item.description && (
                <p className="mt-1 text-gray-500 dark:text-gray-400">{item.description}</p>
              )}
              {item.price && (
                <p className="mt-4 text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                  {item.price}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
