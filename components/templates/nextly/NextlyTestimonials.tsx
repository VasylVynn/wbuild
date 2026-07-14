import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Testimonials — port of the source Testimonials.tsx card: gray-100
 * rounded-2xl panels (`dark:bg-neutral-800` in place of the source's
 * deprecated `dark:bg-trueGray-800`) each closed by an avatar + name +
 * gray-600 title footer. Same data usage as AiSaasTestimonials
 * (title + items[].quote/author/role). `testimonials` items carry no
 * avatar field, so every card renders an indigo initials badge instead
 * of the source's photo (`next/image` static imports dropped — this is
 * user-authored content, not build-time assets).
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

export default function NextlyTestimonials({ data }: { data: unknown }) {
  const d = data as BlockProps["testimonials"];

  return (
    <section className="w-full px-4 py-16 lg:py-20">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto mb-12 flex max-w-2xl flex-col items-center text-center">
          <span className="text-sm font-bold tracking-wider text-indigo-600 uppercase">
            Testimonials
          </span>
          <h2 className="mt-3 text-3xl font-bold leading-snug tracking-tight text-gray-800 lg:text-4xl lg:leading-tight dark:text-white">
            {d.title ?? "What our clients say"}
          </h2>
        </div>

        <div className="grid gap-10 lg:grid-cols-2 xl:grid-cols-3">
          {d.items.map((item, i) => (
            <div
              key={i}
              className="flex h-full flex-col justify-between rounded-2xl bg-gray-100 px-8 py-10 dark:bg-neutral-800 sm:px-14 sm:py-14"
            >
              <p className="text-2xl leading-normal text-gray-800 dark:text-white">
                <mark className="rounded-md bg-indigo-100 text-indigo-800 ring-4 ring-indigo-100 dark:bg-indigo-900 dark:text-indigo-200 dark:ring-indigo-900">
                  &ldquo;{item.quote}&rdquo;
                </mark>
              </p>

              <div className="mt-8 flex items-center space-x-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-lg font-semibold text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200">
                  {initials(item.author)}
                </div>
                <div>
                  <div className="text-lg font-medium text-gray-800 dark:text-white">
                    {item.author}
                  </div>
                  {item.role && (
                    <div className="text-gray-600 dark:text-gray-400">{item.role}</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
