import type { BlockProps } from "@/lib/blocks/schema";
import { ServiceIcon } from "@/components/blocks/icons";

/*
 * Services — rendered as a printed restaurant MENU, not a card grid: a
 * two-column (lg) list of dish rows. Each row is name (serif, ink) + a
 * flexible dotted-leader gap + price (gold, bold), with description in
 * taupe beneath and an optional badge pill / leading icon. Warm dividers
 * separate rows, echoing a paper menu card. Plain server component.
 */
export default function RestaurantServices({ data }: { data: unknown }) {
  const d = data as BlockProps["services"];

  return (
    <section className="bg-[#FBF6EF] py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <span className="text-sm font-semibold uppercase tracking-wide text-[#C0562F]">
            Меню
          </span>
          {d.title && (
            <h2 className="mt-3 text-3xl font-bold text-[#2A2018] md:text-4xl">{d.title}</h2>
          )}
        </div>

        <div className="grid grid-cols-1 gap-x-12 gap-y-8 lg:grid-cols-2">
          {d.items.map((item, i) => (
            <div
              key={i}
              className="border-b border-dashed border-[#2A2018]/15 pb-4 last:border-b-0 lg:last:nth-[-n+2]:border-b-0"
            >
              <div className="flex items-baseline gap-3">
                {item.icon && (
                  <ServiceIcon name={item.icon} className="h-5 w-5 shrink-0 text-[#C0562F]" />
                )}
                <span className="font-serif text-lg font-semibold text-[#2A2018]">
                  {item.name}
                </span>
                {item.badge && (
                  <span className="shrink-0 rounded-full bg-[#5F6F3E] px-2.5 py-0.5 text-xs font-semibold text-white">
                    {item.badge}
                  </span>
                )}
                <span
                  className="mx-1 flex-1 border-b border-dotted border-[#2A2018]/25"
                  aria-hidden="true"
                />
                {item.price && (
                  <span className="shrink-0 font-serif text-lg font-bold text-[#B7791F]">
                    {item.price}
                  </span>
                )}
              </div>
              {item.description && (
                <p className="mt-1.5 text-sm leading-relaxed text-[#6F6257]">
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
