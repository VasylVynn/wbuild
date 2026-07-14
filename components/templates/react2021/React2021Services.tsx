import type { BlockProps } from "@/lib/blocks/schema";
import { ServiceIcon } from "@/components/blocks/icons";

/*
 * Services — port of the source Features.tsx: a centred header (coral
 * uppercase kicker + extrabold dark-ink subtitle) above a 2-col grid where
 * each item is a SQUARE icon box (h-12 w-12 rounded-md border-4 coral
 * border) absolutely positioned next to the name + gray description,
 * mirroring the source's `dt`/`dd` definition-list layout. The section
 * heading uses Product.tsx's alternating word-colour trick (coral / dark
 * ink). Parameterised by our `services` block — icon via ServiceIcon.
 */
export default function React2021Services({ data }: { data: unknown }) {
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
                <span
                  key={i}
                  className={i % 2 ? "text-[#ec4755]" : "text-[#1a2e35]"}
                >
                  {word}{" "}
                </span>
              ))}
            </p>
          )}
        </div>

        <div className="mt-10">
          <dl className="space-y-10 md:grid md:grid-cols-2 md:gap-x-8 md:gap-y-10 md:space-y-0">
            {d.items.map((item, i) => (
              <div key={i} className="relative">
                <dt>
                  {item.icon && (
                    <div className="absolute flex h-12 w-12 items-center justify-center rounded-md border-4 border-[#ec4755] bg-white text-[#ec4755]">
                      <ServiceIcon name={item.icon} className="h-6 w-6" />
                    </div>
                  )}
                  <p className="ml-16 flex items-center gap-2 text-lg leading-6 font-medium text-[#1a2e35]">
                    {item.name}
                    {item.badge && (
                      <span className="rounded-full bg-[#ec4755] px-2 py-0.5 text-xs font-semibold text-white">
                        {item.badge}
                      </span>
                    )}
                  </p>
                </dt>
                <dd className="mt-2 ml-16 text-base text-gray-500">
                  {item.description && <p>{item.description}</p>}
                  {item.price && (
                    <p className="mt-2 font-semibold text-[#ec4755]">{item.price}</p>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
