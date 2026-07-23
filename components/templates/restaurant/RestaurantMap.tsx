import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Map — the `map` block in restaurant dress: the geocode-free Google embed in
 * a rounded warm card on the cream canvas, address in serif ink and a
 * terracotta «Прокласти маршрут» pill. Link behaviour matches
 * components/blocks/Map.tsx; the address is a grounded fact. Server component.
 */
export default function RestaurantMap({ data }: { data: unknown }) {
  const d = data as BlockProps["map"];
  const q = encodeURIComponent(d.address);

  return (
    <section className="bg-[#FBF6EF] py-16 sm:py-20">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {d.title && (
          <h2 className="mb-10 text-center font-serif text-3xl font-bold text-[#2A2018] md:text-4xl">
            {d.title}
          </h2>
        )}

        <div className="overflow-hidden rounded-3xl border border-[#2A2018]/10 bg-white">
          <iframe
            src={`https://www.google.com/maps?q=${q}&output=embed`}
            title={`Карта: ${d.address}`}
            className="h-72 w-full md:h-96"
            style={{ border: 0 }}
            loading="lazy"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
          />
          <div className="flex flex-col gap-4 border-t border-dashed border-[#2A2018]/15 p-6 sm:flex-row sm:items-center sm:justify-between md:p-8">
            <p className="font-serif text-lg text-[#2A2018]">{d.address}</p>
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${q}`}
              target="_blank"
              rel="noopener"
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#C0562F] px-7 py-3 font-semibold text-white transition hover:bg-[#A64826]"
            >
              Прокласти маршрут
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
