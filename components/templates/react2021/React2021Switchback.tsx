import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Switchback — zig-zag story rows the source react-2021 template lacks: a
 * large photo paired with a prose column, the pair mirroring left/right on
 * each successive row. Coral design language: uppercase kicker +
 * alternating-word title (Services/Process), a coral bullet+rule accent over
 * an extrabold dark-ink heading, gray body, and the Hero's filled coral CTA.
 * The photo carries react-2021's signature coral border as a ring (echoing
 * the square coral-bordered icons). §4.8: the image comes from props only; a
 * row without one degrades to a centred full-width text card.
 */
export default function React2021Switchback({ data }: { data: unknown }) {
  const d = data as BlockProps["switchback"];

  return (
    <section className="bg-white py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {d.title && (
          <div className="mb-12 lg:text-center">
            <span className="text-sm font-semibold uppercase tracking-wide text-[#ec4755]">
              Наша історія
            </span>
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
          </div>
        )}

        <div className="space-y-16 lg:space-y-24">
          {d.items.map((item, i) => {
            const flip = i % 2 === 1;
            const hasImage = Boolean(item.imageUrl);
            return (
              <div
                key={i}
                className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16"
              >
                {hasImage && (
                  <div className={flip ? "lg:order-2" : ""}>
                    <img
                      src={item.imageUrl}
                      alt={item.heading}
                      className="h-72 w-full rounded-2xl object-cover shadow-xl ring-4 ring-[#ec4755]/15 sm:h-80 lg:h-[26rem]"
                    />
                  </div>
                )}

                <div
                  className={`${hasImage && flip ? "lg:order-1" : ""} ${
                    hasImage ? "" : "mx-auto max-w-3xl text-center lg:col-span-2"
                  }`}
                >
                  <div
                    className={`flex items-center gap-3 ${
                      hasImage ? "" : "justify-center"
                    }`}
                  >
                    <span className="h-2 w-2 rounded-full bg-[#ec4755]" />
                    <span className="h-px w-14 bg-[#ec4755]/40" />
                  </div>
                  <h3 className="mt-4 text-2xl font-extrabold tracking-tight text-[#1a2e35] sm:text-3xl">
                    {item.heading}
                  </h3>
                  <p className="mt-4 text-base leading-relaxed text-gray-500 sm:text-lg">
                    {item.body}
                  </p>
                  {item.buttonLabel && (
                    <a
                      href={item.buttonHref ?? "#contacts"}
                      className="mt-6 inline-flex items-center justify-center rounded-md bg-[#ec4755] px-8 py-3 font-medium text-white transition-colors hover:bg-[#a12c34]"
                    >
                      {item.buttonLabel}
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
