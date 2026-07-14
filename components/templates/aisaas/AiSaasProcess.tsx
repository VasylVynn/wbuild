import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Process — a `timeline` block rendered as numbered steps rather than a
 * classic date-rail timeline: a big coral index badge per step, connected on
 * lg by a thin pastel dot+line rail (flex row, one flex-1 column per step so
 * the rail works for any item count), collapsing to a plain vertical stack
 * on mobile. No images — pure typography + colour, matching the aisaas
 * pastel-chip language used across the other sections.
 */
export default function AiSaasProcess({ data }: { data: unknown }) {
  const d = data as BlockProps["timeline"];

  return (
    <section className="bg-white py-16">
      <div className="mx-auto max-w-6xl px-4">
        {d.title && (
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <span className="mb-3 inline-block text-sm font-semibold text-[#E07A5F]">
              Як ми працюємо
            </span>
            <h2 className="text-3xl font-bold text-[#2F4550] md:text-4xl">{d.title}</h2>
          </div>
        )}

        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-6">
          {d.items.map((item, i) => (
            <div key={i} className="flex flex-col items-start lg:flex-1 lg:items-center lg:text-center">
              <span className="text-4xl font-bold text-[#E07A5F] sm:text-5xl">
                {String(i + 1).padStart(2, "0")}
              </span>
              {item.period && (
                <span className="mt-1 text-xs font-semibold tracking-wide text-[#3D8690] uppercase">
                  {item.period}
                </span>
              )}

              <div className="mt-4 flex w-full items-center lg:mt-5">
                <span className="h-2.5 w-2.5 flex-none rounded-full bg-[#E07A5F]" aria-hidden="true" />
                {i < d.items.length - 1 && (
                  <span
                    className="ml-2 hidden h-px flex-1 bg-gradient-to-r from-[#FDE1D3] to-[#D3E4FD] lg:block"
                    aria-hidden="true"
                  />
                )}
              </div>

              <h3 className="mt-4 text-lg font-bold text-[#2F4550]">{item.title}</h3>
              {item.subtitle && (
                <span className="mt-2 inline-block rounded-full bg-[#D3E4FD] px-3 py-1 text-xs font-semibold text-[#3D8690]">
                  {item.subtitle}
                </span>
              )}
              {item.description && (
                <p className="mt-3 text-sm leading-relaxed text-[#2F4550]/80 lg:px-2">
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
