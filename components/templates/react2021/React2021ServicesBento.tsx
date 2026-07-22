import type { BlockProps } from "@/lib/blocks/schema";
import { ServiceIcon } from "@/components/blocks/icons";

/*
 * Services · variant "bento" — the base React2021Services is a uniform 2-col
 * definition list with the coral icon square set beside the text. This is an
 * asymmetric bento grid: the first item is a wide feature cell (dark-ink field)
 * and the rest are standard cells, with the icon stacked ABOVE the text in each.
 * Changes column count (uniform 2-col → asymmetric 3-col grid), item order
 * (icon-left → icon-top) and density paradigm (list → bento). Same coral tokens,
 * alternating-word heading and ServiceIcon usage.
 */
export default function React2021ServicesBento({ data }: { data: unknown }) {
  const d = data as BlockProps["services"];

  return (
    <section className="bg-white py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="lg:text-center">
          <span className="text-sm font-semibold uppercase tracking-wide text-[#ec4755]">
            Наші послуги
          </span>
          {d.title && (
            <p className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
              {d.title.split(" ").map((word, i) => (
                <span key={i} className={i % 2 ? "text-[#ec4755]" : "text-[#1a2e35]"}>
                  {word}{" "}
                </span>
              ))}
            </p>
          )}
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {d.items.map((item, i) => {
            const feature = i === 0;
            return (
              <div
                key={i}
                className={`flex flex-col rounded-2xl border p-6 transition-shadow hover:shadow-md ${
                  feature
                    ? "border-[#1a2e35] bg-[#1a2e35] sm:col-span-2 lg:col-span-2"
                    : "border-gray-100 bg-gray-50"
                }`}
              >
                {item.icon && (
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-md border-4 border-[#ec4755] bg-white text-[#ec4755]">
                    <ServiceIcon name={item.icon} className="h-6 w-6" />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <h3 className={`font-bold ${feature ? "text-xl text-white sm:text-2xl" : "text-lg text-[#1a2e35]"}`}>
                    {item.name}
                  </h3>
                  {item.badge && (
                    <span className="rounded-full bg-[#ec4755] px-2 py-0.5 text-xs font-semibold text-white">
                      {item.badge}
                    </span>
                  )}
                </div>
                {item.description && (
                  <p className={`mt-2 text-sm ${feature ? "text-gray-300 sm:text-base" : "text-gray-500"}`}>
                    {item.description}
                  </p>
                )}
                {item.price && (
                  <p className="mt-auto pt-4 font-semibold text-[#ec4755]">{item.price}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
