import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Switchback — nextly-styled alternating "story" rows: a rounded-2xl photo
 * paired with a prose column, the pair mirroring left/right on each successive
 * row (the classic marketing feature zig-zag the nextly source lacks). Header
 * follows nextly's SectionTitle language (indigo eyebrow + bold heading); the
 * text column carries nextly's indigo dot+line accent and reuses the Hero/CTA
 * indigo button. §4.8: images come from props only — a row without one degrades
 * to a centred full-width text card (mirrors SalonSwitchback's fallback). Plain
 * server component; the zig-zag is pure CSS `order`, no client state.
 */
export default function NextlySwitchback({ data }: { data: unknown }) {
  const d = data as BlockProps["switchback"];

  return (
    <section className="bg-white py-16 dark:bg-neutral-900 lg:py-20">
      <div className="mx-auto max-w-7xl px-4">
        {d.title && (
          <div className="mx-auto mb-12 flex max-w-2xl flex-col items-center text-center">
            <span className="text-sm font-bold tracking-wider text-indigo-600 uppercase">
              Історія
            </span>
            <h2 className="mt-3 text-3xl font-bold leading-snug tracking-tight text-gray-800 lg:text-4xl lg:leading-tight dark:text-white">
              {d.title}
            </h2>
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
                  <div className={`relative ${flip ? "lg:order-2" : ""}`}>
                    <div
                      className="absolute -inset-4 rounded-3xl bg-gradient-to-tr from-indigo-500/15 to-indigo-300/10 blur-2xl"
                      aria-hidden="true"
                    />
                    <img
                      src={item.imageUrl}
                      alt={item.heading}
                      className="relative h-[320px] w-full rounded-2xl object-cover shadow-sm sm:h-[420px]"
                    />
                  </div>
                )}

                <div
                  className={`${flip ? "lg:order-1" : ""} ${
                    hasImage ? "" : "mx-auto max-w-2xl text-center lg:col-span-2"
                  }`}
                >
                  <div className={`flex items-center gap-3 ${hasImage ? "" : "justify-center"}`}>
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                    <span className="h-px w-14 bg-gradient-to-r from-indigo-500 to-transparent" />
                  </div>

                  <h3 className="mt-5 text-3xl font-bold leading-snug tracking-tight text-gray-800 lg:text-4xl lg:leading-tight dark:text-white">
                    {item.heading}
                  </h3>
                  <p className="mt-4 text-lg leading-normal text-gray-500 dark:text-gray-300">
                    {item.body}
                  </p>

                  {item.buttonLabel && (
                    <a
                      href={item.buttonHref ?? "#contacts"}
                      className="mt-6 inline-block rounded-md bg-indigo-600 px-8 py-4 text-lg font-medium text-white transition-colors hover:bg-indigo-500"
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
