import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Process — timeline block rendered as numbered steps. Header mirrors
 * Services' coral kicker + extrabold alternating-word title. Each step
 * leads with a big zero-padded coral index (Stats' bold-coral-number
 * feel), a dark-ink title, an optional small coral tag (subtitle) and a
 * gray-500 description. A thin coral connector line with an arrow chevron
 * links steps horizontally on lg; on mobile it collapses to a vertical
 * stack with a left-edge connector line, matching SalonProcess's
 * responsive pattern. Plain server component, no client state.
 */
export default function React2021Process({ data }: { data: unknown }) {
  const d = data as BlockProps["timeline"];

  return (
    <section className="bg-gray-50 py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="lg:text-center">
          <span className="text-sm font-semibold uppercase tracking-wide text-[#ec4755]">
            Наш процес
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

        <div className="mt-12 flex flex-col gap-12 lg:mt-16 lg:flex-row lg:items-start lg:gap-6">
          {d.items.map((item, i) => (
            <div key={i} className="relative flex-1">
              <div className="relative flex flex-col items-start lg:items-center lg:text-center">
                {i < d.items.length - 1 && (
                  <>
                    {/* Mobile: vertical connector down the left edge */}
                    <span
                      className="absolute top-16 bottom-[-3rem] left-7 w-px bg-[#ec4755]/25 lg:hidden"
                      aria-hidden="true"
                    />
                    {/* Desktop: horizontal connector with arrow to the next step */}
                    <div
                      className="pointer-events-none absolute top-7 left-1/2 hidden w-full lg:block"
                      aria-hidden="true"
                    >
                      <div className="h-px w-full bg-[#ec4755]/25" />
                      <svg
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="absolute top-1/2 right-0 h-3 w-3 -translate-y-1/2 text-[#ec4755]"
                      >
                        <path
                          fillRule="evenodd"
                          d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  </>
                )}

                <span className="text-5xl leading-none font-extrabold text-[#ec4755] sm:text-6xl">
                  {String(i + 1).padStart(2, "0")}
                </span>

                <div className="mt-4 max-w-xs space-y-2 lg:mt-6">
                  {item.period && (
                    <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
                      {item.period}
                    </p>
                  )}
                  <h3 className="text-xl font-bold text-[#1a2e35]">{item.title}</h3>
                  {item.subtitle && (
                    <span className="inline-block rounded-full border border-[#ec4755]/30 bg-[#ec4755]/10 px-3 py-1 text-xs font-semibold tracking-wide text-[#ec4755] uppercase">
                      {item.subtitle}
                    </span>
                  )}
                  {item.description && (
                    <p className="text-base leading-relaxed text-gray-500">
                      {item.description}
                    </p>
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
