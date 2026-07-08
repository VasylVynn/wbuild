import type { BlockProps } from "@/lib/blocks/schema";

/**
 * Services — SKINS (layout variants of the SAME content, brief §3):
 *  - ""        card grid (image + name + description + price) — the original.
 *  - "list"    menu-style rows: name + dotted leader + price, description under.
 *  - "compact" tight accent grid: name + price only (no description/images).
 * Only layout changes between skins; content/props are identical. All skins use
 * only tenant CSS vars and keep the section's background/foreground identity.
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
                alt=""
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
      ) : (
        <ServicesCards data={data} />
      )}
    </section>
  );
}
