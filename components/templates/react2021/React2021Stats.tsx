import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Stats — port of the source's coral number-band feel (Features.tsx kicker +
 * extrabold heading, Product.tsx's thin coral divider bar) applied to a
 * responsive grid of big bold coral values over muted gray labels. Same
 * field usage as AiSaasStats (optional title + items[].value/label) —
 * renders only the stat items the data actually carries, no invented
 * numbers.
 */
export default function React2021Stats({ data }: { data: unknown }) {
  const d = data as BlockProps["stats"];

  return (
    <section className="bg-white py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <span className="text-sm font-semibold uppercase tracking-wide text-[#ec4755]">
            Наші показники
          </span>
          {d.title && (
            <p className="mt-2 text-3xl font-extrabold tracking-tight text-[#1a2e35] sm:text-4xl">
              {d.title}
            </p>
          )}
          <div className="mx-auto mt-4 h-1 w-24 rounded-t bg-[#ec4755] opacity-25" />
        </div>

        <div className="mt-10 grid grid-cols-2 gap-8 md:grid-cols-4">
          {d.items.map((stat, i) => (
            <div key={i} className="text-center">
              <p className="text-4xl font-extrabold text-[#ec4755] md:text-5xl">{stat.value}</p>
              <p className="mt-2 text-sm text-gray-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
