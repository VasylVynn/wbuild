import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Publications — a register of works / books / articles / press the source
 * react-2021 template lacks. Coral design language: uppercase kicker +
 * alternating-word title over a stacked list of gray-50 rounded rows. Each
 * row leads with react-2021's signature square coral-bordered box holding the
 * year (a coral dot when a row has none), then the title in dark ink, an
 * optional gray subtitle, and the source as a small coral uppercase tag.
 * Plain server component — no images, no client state.
 */
export default function React2021Publications({ data }: { data: unknown }) {
  const d = data as BlockProps["publications"];

  return (
    <section className="bg-white py-12 sm:py-16">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="lg:text-center">
          <span className="text-sm font-semibold uppercase tracking-wide text-[#ec4755]">
            Публікації
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

        <ul className="mt-10 space-y-4">
          {d.items.map((item, i) => (
            <li
              key={i}
              className="flex items-start gap-5 rounded-lg bg-gray-50 p-5 sm:p-6"
            >
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border-4 border-[#ec4755] bg-white text-center text-sm font-bold leading-tight text-[#ec4755]">
                {item.year ?? (
                  <span className="h-2.5 w-2.5 rounded-full bg-[#ec4755]" />
                )}
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-[#1a2e35]">{item.title}</h3>
                {item.subtitle && (
                  <p className="mt-1 text-sm text-gray-500">{item.subtitle}</p>
                )}
                {item.source && (
                  <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-[#ec4755]">
                    {item.source}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
