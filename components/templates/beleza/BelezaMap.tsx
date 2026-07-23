import type { BlockProps } from "@/lib/blocks/schema";
import { Reveal } from "@/components/templates/shared/reveal";

/*
 * Map — the `map` block in beleza dress: the geocode-free Google embed inside
 * a soft rounded card (the template's beleza-card radius language), address
 * line and a rose «Прокласти маршрут» pill underneath. Link behaviour is
 * identical to components/blocks/Map.tsx.
 */
export default function BelezaMap({ data }: { data: unknown }) {
  const d = data as BlockProps["map"];
  const q = encodeURIComponent(d.address);

  return (
    <section className="beleza-section">
      <div className="beleza-container">
        {d.title && (
          <Reveal className="mb-12 md:mb-16">
            <h2 className="beleza-kicker">
              <strong>{d.title}</strong> Завітайте до нас — ось як нас знайти.
            </h2>
          </Reveal>
        )}
        <Reveal>
          <div
            className="overflow-hidden rounded-3xl border"
            style={{ borderColor: "var(--beleza-border)" }}
          >
            <iframe
              src={`https://www.google.com/maps?q=${q}&output=embed`}
              title={`Карта: ${d.address}`}
              className="h-72 w-full md:h-96"
              style={{ border: 0 }}
              loading="lazy"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
          <div className="mt-6 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="beleza-muted text-base leading-relaxed">{d.address}</p>
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${q}`}
              target="_blank"
              rel="noopener"
              className="inline-flex shrink-0 items-center gap-2 rounded-full px-7 py-3 text-sm font-bold text-white transition-transform hover:-translate-y-0.5"
              style={{ background: "var(--beleza-branding)" }}
            >
              Прокласти маршрут
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
