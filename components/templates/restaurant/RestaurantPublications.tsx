import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Publications — «про нас пишуть»: press mentions, features and awards. Read
 * as an editorial credits wall on the warm sand band: each entry leads with a
 * large faint gold serif year, then a serif title, an italic subtitle and a
 * small source (the outlet / award body). Only real mentions render — every
 * field but the title is optional and guarded. Plain server component.
 *
 * Default: hairline-divided credits list.
 * `cards` variant: a responsive grid of warm cards, each with a gold year badge.
 */
function PublicationsHeader({ title }: { title?: string }) {
  if (!title) return null;
  return (
    <div className="mx-auto mb-12 max-w-2xl text-center">
      <h2 className="text-3xl font-bold text-[#2A2018] md:text-4xl">{title}</h2>
    </div>
  );
}

export default function RestaurantPublications({ data }: { data: unknown }) {
  const d = data as BlockProps["publications"];

  return (
    <section className="bg-[#F3EADD] py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <PublicationsHeader title={d.title} />

        <div className="mx-auto max-w-4xl divide-y divide-[#2A2018]/10 border-y border-[#2A2018]/10">
          {d.items.map((item, i) => (
            <div key={i} className="flex flex-col gap-3 py-6 sm:flex-row sm:items-baseline sm:gap-8">
              {item.year && (
                <span className="font-display text-3xl font-semibold text-[#B7791F]/50">
                  {item.year}
                </span>
              )}
              <div>
                <h3 className="text-xl font-semibold text-[#2A2018]">{item.title}</h3>
                {item.subtitle && <p className="mt-1 italic text-[#6F6257]">{item.subtitle}</p>}
                {item.source && <p className="mt-2 text-sm text-[#6F6257]">{item.source}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function RestaurantPublicationsCards({ data }: { data: unknown }) {
  const d = data as BlockProps["publications"];

  return (
    <section className="bg-[#F3EADD] py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <PublicationsHeader title={d.title} />

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {d.items.map((item, i) => (
            <div
              key={i}
              className="flex h-full flex-col rounded-2xl bg-white p-8 shadow-[0_4px_24px_rgba(42,32,24,0.08)]"
            >
              {item.year && (
                <span className="mb-4 inline-flex w-fit rounded-full bg-[#F3EADD] px-3 py-1 text-sm font-semibold text-[#B7791F]">
                  {item.year}
                </span>
              )}
              <h3 className="text-lg font-semibold text-[#2A2018]">{item.title}</h3>
              {item.subtitle && <p className="mt-2 italic text-[#6F6257]">{item.subtitle}</p>}
              {item.source && <p className="mt-3 text-sm text-[#6F6257]">{item.source}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
