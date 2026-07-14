import type { BlockProps } from "@/lib/blocks/schema";
import { ServiceIcon } from "@/components/blocks/icons";

/*
 * Highlights — a `services` block rendered as an asymmetric BENTO grid,
 * deliberately distinct from AiSaasServices' uniform 3-col card grid. The
 * first item becomes a large feature tile (spans 4/6 cols + 2 rows on lg,
 * pastel gradient fill); the remaining items are smaller 2/6-col tiles in
 * the flat lavender fill, alternating icon-chip colour. price/badge are
 * intentionally ignored — highlights sell value props, not offers.
 */
export default function AiSaasHighlights({ data }: { data: unknown }) {
  const d = data as BlockProps["services"];

  return (
    <section className="bg-white py-16">
      <div className="mx-auto max-w-6xl px-4">
        {d.title && (
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <span className="mb-3 inline-block text-sm font-semibold text-[#E07A5F]">
              Переваги
            </span>
            <h2 className="text-3xl font-bold text-[#2F4550] md:text-4xl">{d.title}</h2>
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-6 lg:auto-rows-[1fr]">
          {d.items.map((item, i) => {
            const isFeature = i === 0;
            const chipClass = i % 2 === 0 ? "bg-[#D3E4FD] text-[#3D8690]" : "bg-[#FDE1D3] text-[#E07A5F]";

            return (
              <div
                key={i}
                className={`group rounded-3xl p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg sm:p-8 ${
                  isFeature
                    ? "sm:col-span-2 lg:col-span-4 lg:row-span-2 bg-gradient-to-br from-[#D3E4FD] to-[#FDE1D3]"
                    : "lg:col-span-2 bg-[#F1F0FB]"
                }`}
              >
                {item.icon && (
                  <div
                    className={`mb-5 flex items-center justify-center rounded-2xl ${chipClass} ${
                      isFeature ? "h-16 w-16" : "h-14 w-14"
                    }`}
                  >
                    <ServiceIcon name={item.icon} className={isFeature ? "h-7 w-7" : "h-6 w-6"} />
                  </div>
                )}

                <h3 className={`font-bold text-[#2F4550] ${isFeature ? "text-2xl" : "text-lg"}`}>
                  {item.name}
                </h3>
                {item.description && (
                  <p
                    className={`mt-2 leading-relaxed text-[#2F4550]/80 ${
                      isFeature ? "text-base" : "text-sm"
                    }`}
                  >
                    {item.description}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
