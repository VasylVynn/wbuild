import type { BlockProps } from "@/lib/blocks/schema";

/**
 * Map — Google Maps embed for the CONFIRMED address (refactor 03 §2.4). The
 * address is a fact grounded 1:1 in assemble(); the embed is geocode-free (the
 * iframe queries by the address string, no API key), and «Прокласти маршрут»
 * opens turn-by-turn directions to the same address.
 */
export default function Map({ data }: { data: BlockProps["map"] }) {
  const { title, address } = data;
  const q = encodeURIComponent(address);

  return (
    <section
      style={{
        backgroundColor: "var(--color-background)",
        color: "var(--color-foreground)",
      }}
    >
      <div className="mx-auto max-w-5xl px-4 py-16">
        {title && (
          <h2
            className="mb-12 text-3xl font-bold md:text-4xl"
            style={{ fontFamily: "var(--font-heading)", color: "var(--color-foreground)" }}
          >
            {title}
          </h2>
        )}

        <div
          className="overflow-hidden rounded-[var(--radius)]"
          style={{ border: "1px solid var(--color-muted)" }}
        >
          <iframe
            src={`https://www.google.com/maps?q=${q}&output=embed`}
            title={`Карта: ${address}`}
            className="h-80 w-full md:h-96"
            style={{ border: 0 }}
            loading="lazy"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>

        <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xl" style={{ color: "var(--color-muted-foreground)" }}>
            {address}
          </p>
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${q}`}
            target="_blank"
            rel="noopener"
            className="inline-flex min-h-[44px] items-center justify-center rounded-full px-6 py-3 text-lg font-semibold"
            style={{
              backgroundColor: "var(--color-primary)",
              color: "var(--color-primary-foreground)",
            }}
          >
            Прокласти маршрут
          </a>
        </div>
      </div>
    </section>
  );
}
