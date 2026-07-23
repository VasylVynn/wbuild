"use client";

import type { BlockProps } from "@/lib/blocks/schema";
import { Reveal } from "../shared/reveal";

/*
 * Map — the `map` block in studio dress: the geocode-free Google embed inside
 * a bordered dark `.card` (link behaviour identical to components/blocks/
 * Map.tsx), address line + `.btn-gradient` directions button underneath. The
 * embed itself is light — the card frame keeps it reading as a deliberate
 * panel on the dark canvas.
 */
export default function MapSection({ data }: { data: unknown }) {
  const d = data as BlockProps["map"];
  const q = encodeURIComponent(d.address);

  return (
    <section className="py-12 md:py-16" aria-labelledby={d.title ? "map-title" : undefined}>
      <div className="container mx-auto px-4 sm:px-6">
        <Reveal margin="-80px" className="card max-w-3xl mx-auto !p-0 overflow-hidden">
          <div className="p-6 md:p-8">
            {d.title && <h2 id="map-title" className="section-title mb-6">{d.title}</h2>}
          </div>
          <iframe
            src={`https://www.google.com/maps?q=${q}&output=embed`}
            title={`Карта: ${d.address}`}
            className="h-72 w-full md:h-80"
            style={{ border: 0 }}
            loading="lazy"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
          />
          <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between md:p-8">
            <p className="text-base text-zinc-300">{d.address}</p>
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${q}`}
              target="_blank"
              rel="noopener"
              className="btn-gradient shrink-0"
            >
              Прокласти маршрут
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
