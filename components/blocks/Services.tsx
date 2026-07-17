import type { BlockProps } from "@/lib/blocks/schema";
import { ServiceIcon } from "@/components/blocks/icons";

/**
 * Services — SKINS (layout variants of the SAME content, brief §3):
 *  - ""         card grid (image + name + description + price) — the original.
 *  - "list"     menu-style rows: name + dotted leader + price, description under.
 *  - "compact"  tight accent grid: name + price only (no description/images).
 *  - "trust"    icon feature grid: tinted icon circle + name + description.
 *  - "showcase" image cards with hover-zoom + dark gradient name/price overlay.
 *  - "pricing"  bordered price cards; a `badge` item gets an accent border+chip.
 *  - "steps"    numbered process rows: large muted ordinal + name + description.
 * Only layout changes between skins; content/props are identical. All skins use
 * only tenant CSS vars and keep the section's background/foreground identity.
 * Every skin degrades gracefully when optional fields (icon/price/description/
 * image/badge) are absent.
 */

type ServicesData = BlockProps["services"];

function SectionTitle({ title }: { title: string }) {
  return (
    <h2
      className="mb-12 text-3xl font-bold md:text-4xl"
      style={{ fontFamily: "var(--font-heading)", color: "var(--color-foreground)" }}
    >
      {title}
    </h2>
  );
}

// "" — the original card grid, extracted unchanged.
function ServicesCards({ data }: { data: ServicesData }) {
  const { title, items } = data;
  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      {title && <SectionTitle title={title} />}

      <ul className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, index) => (
          <li
            key={index}
            className="flex flex-col overflow-hidden rounded-[var(--radius)]"
            style={{ backgroundColor: "var(--color-accent)" }}
          >
            {item.imageUrl && (
              <img
                src={item.imageUrl}
                alt={item.name}
                loading="lazy"
                className="h-48 w-full object-cover"
              />
            )}

            <div className="flex flex-1 flex-col gap-3 p-6">
              <h3
                className="text-xl font-semibold"
                style={{ fontFamily: "var(--font-heading)", color: "var(--color-foreground)" }}
              >
                {item.name}
              </h3>

              {item.description && (
                <p
                  className="flex-1 text-base leading-relaxed"
                  style={{ color: "var(--color-muted-foreground)" }}
                >
                  {item.description}
                </p>
              )}

              {item.price && (
                <p
                  className="mt-auto text-lg font-semibold"
                  style={{ color: "var(--color-primary)" }}
                >
                  {item.price}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// "list" — menu-style rows with a dotted leader line between name and price.
function ServicesList({ data }: { data: ServicesData }) {
  const { title, items } = data;
  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      {title && <SectionTitle title={title} />}

      <ul>
        {items.map((item, index) => (
          <li
            key={index}
            className="py-6"
            style={{
              borderTop: index === 0 ? undefined : "1px solid var(--color-muted)",
            }}
          >
            <div className="flex items-baseline gap-3">
              <h3
                className="text-xl font-bold"
                style={{ fontFamily: "var(--font-heading)", color: "var(--color-foreground)" }}
              >
                {item.name}
              </h3>
              {item.price && (
                <>
                  <span
                    aria-hidden
                    className="flex-1"
                    style={{ borderBottom: "1px dotted var(--color-muted)" }}
                  />
                  <span
                    className="shrink-0 text-lg font-semibold"
                    style={{ color: "var(--color-primary)" }}
                  >
                    {item.price}
                  </span>
                </>
              )}
            </div>

            {item.description && (
              <p
                className="mt-2 text-base leading-relaxed"
                style={{ color: "var(--color-muted-foreground)" }}
              >
                {item.description}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// "compact" — tight 2/3-column accent grid, name + price only.
function ServicesCompact({ data }: { data: ServicesData }) {
  const { title, items } = data;
  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      {title && <SectionTitle title={title} />}

      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {items.map((item, index) => (
          <li
            key={index}
            className="flex flex-col gap-2 rounded-[var(--radius)] p-4"
            style={{ backgroundColor: "var(--color-accent)" }}
          >
            <h3
              className="text-lg font-semibold"
              style={{ fontFamily: "var(--font-heading)", color: "var(--color-foreground)" }}
            >
              {item.name}
            </h3>
            {item.price && (
              <p
                className="mt-auto text-base font-semibold"
                style={{ color: "var(--color-primary)" }}
              >
                {item.price}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// "trust" — icon feature grid (2/3/4-col). Tinted icon circle over a bold name
// and muted description. Ignores price/image; falls back to the "check" icon.
function ServicesTrust({ data }: { data: ServicesData }) {
  const { title, items } = data;
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      {title && <SectionTitle title={title} />}

      <ul className="grid grid-cols-2 gap-8 md:grid-cols-3 lg:grid-cols-4">
        {items.map((item, index) => (
          <li key={index} className="flex flex-col items-center gap-3 text-center">
            <span
              className="flex h-16 w-16 items-center justify-center rounded-full"
              style={{
                backgroundColor:
                  "color-mix(in srgb, var(--color-primary) 12%, transparent)",
                color: "var(--color-primary)",
              }}
            >
              <ServiceIcon name={item.icon ?? "check"} className="h-8 w-8" />
            </span>

            <h3
              className="text-lg font-semibold"
              style={{ fontFamily: "var(--font-heading)", color: "var(--color-foreground)" }}
            >
              {item.name}
            </h3>

            {item.description && (
              <p
                className="text-sm leading-relaxed"
                style={{ color: "var(--color-muted-foreground)" }}
              >
                {item.description}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// "showcase" — image cards with hover-zoom and a dark bottom gradient carrying
// name + price. Items without an image show a tinted panel with an oversized
// initial (HeroSplit's trick) so the grid never looks broken. The scrim is
// always dark, so its text is fixed light — not a tenant token — for legibility
// over arbitrary photos.
function ServicesShowcase({ data }: { data: ServicesData }) {
  const { title, items } = data;
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      {title && <SectionTitle title={title} />}

      <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, index) => (
          <li
            key={index}
            className="group relative overflow-hidden rounded-[var(--radius)]"
            style={{ backgroundColor: "var(--color-accent)" }}
          >
            <div className="aspect-[4/3] w-full overflow-hidden">
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div
                  aria-hidden
                  className="flex h-full w-full items-center justify-center"
                  style={{
                    backgroundColor:
                      "color-mix(in srgb, var(--color-primary) 12%, transparent)",
                  }}
                >
                  <span
                    className="font-bold leading-none"
                    style={{
                      fontFamily: "var(--font-heading)",
                      color: "var(--color-primary)",
                      opacity: 0.3,
                      fontSize: "6rem",
                    }}
                  >
                    {item.name.charAt(0)}
                  </span>
                </div>
              )}
            </div>

            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-1 p-5"
              style={{
                background:
                  "linear-gradient(to top, rgba(0,0,0,0.75), rgba(0,0,0,0))",
              }}
            >
              <h3
                className="text-lg font-semibold"
                style={{ fontFamily: "var(--font-heading)", color: "#fff" }}
              >
                {item.name}
              </h3>
              {item.price && (
                <p
                  className="text-sm font-semibold"
                  style={{ color: "rgba(255,255,255,0.9)" }}
                >
                  {item.price}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// "pricing" — bordered rounded-xl price cards (1/2/4-col by count). An item with
// a `badge` gets an accent primary border + a chip pinned to the top edge.
function ServicesPricing({ data }: { data: ServicesData }) {
  const { title, items } = data;
  const lgCols =
    items.length === 1
      ? "lg:grid-cols-1"
      : items.length === 2
        ? "lg:grid-cols-2"
        : items.length === 3
          ? "lg:grid-cols-3"
          : "lg:grid-cols-4";
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      {title && <SectionTitle title={title} />}

      <ul className={`grid grid-cols-1 gap-6 sm:grid-cols-2 ${lgCols}`}>
        {items.map((item, index) => (
          <li
            key={index}
            className="relative flex flex-col gap-3 rounded-xl p-6"
            style={{
              backgroundColor: "var(--color-background)",
              border: item.badge
                ? "2px solid var(--color-primary)"
                : "1px solid var(--color-muted)",
            }}
          >
            {item.badge && (
              <span
                className="absolute -top-3 left-6 rounded-full px-3 py-1 text-xs font-semibold"
                style={{
                  backgroundColor: "var(--color-primary)",
                  color: "var(--color-primary-foreground)",
                }}
              >
                {item.badge}
              </span>
            )}

            {item.price && (
              <p className="text-3xl font-bold" style={{ color: "var(--color-primary)" }}>
                {item.price}
              </p>
            )}

            <h3
              className="text-xl font-semibold"
              style={{ fontFamily: "var(--font-heading)", color: "var(--color-foreground)" }}
            >
              {item.name}
            </h3>

            {item.description && (
              <p
                className="text-sm leading-relaxed"
                style={{ color: "var(--color-muted-foreground)" }}
              >
                {item.description}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// "steps" — numbered process rows: a large muted ordinal beside the name +
// description, with a subtle left rule for a connected, sequential feel.
function ServicesSteps({ data }: { data: ServicesData }) {
  const { title, items } = data;
  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      {title && <SectionTitle title={title} />}

      <ol className="space-y-8">
        {items.map((item, index) => (
          <li key={index} className="flex gap-6">
            <span
              aria-hidden
              className="shrink-0 text-4xl font-bold leading-none tabular-nums md:text-5xl"
              style={{
                fontFamily: "var(--font-heading)",
                color: "var(--color-primary)",
                opacity: 0.25,
              }}
            >
              {String(index + 1).padStart(2, "0")}
            </span>

            <div
              className="flex flex-col gap-2 pb-2 pl-6"
              style={{ borderLeft: "1px solid var(--color-muted)" }}
            >
              <h3
                className="text-xl font-semibold"
                style={{ fontFamily: "var(--font-heading)", color: "var(--color-foreground)" }}
              >
                {item.name}
              </h3>

              {item.description && (
                <p
                  className="text-base leading-relaxed"
                  style={{ color: "var(--color-muted-foreground)" }}
                >
                  {item.description}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function Services({
  data,
  skin,
}: {
  data: ServicesData;
  skin?: string;
}) {
  return (
    <section
      style={{
        backgroundColor: "var(--color-background)",
        color: "var(--color-foreground)",
      }}
    >
      {skin === "list" ? (
        <ServicesList data={data} />
      ) : skin === "compact" ? (
        <ServicesCompact data={data} />
      ) : skin === "trust" ? (
        <ServicesTrust data={data} />
      ) : skin === "showcase" ? (
        <ServicesShowcase data={data} />
      ) : skin === "pricing" ? (
        <ServicesPricing data={data} />
      ) : skin === "steps" ? (
        <ServicesSteps data={data} />
      ) : (
        <ServicesCards data={data} />
      )}
    </section>
  );
}
