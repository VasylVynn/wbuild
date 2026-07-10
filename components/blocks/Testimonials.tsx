import type { BlockProps } from "@/lib/blocks/schema";

/**
 * Testimonials — SKINS (layout variants of the SAME content, brief §3):
 *  - ""          two-column accent cards with a primary left border — original.
 *  - "spotlight" the FIRST item as a large centred pull-quote; any remaining
 *                items follow as a compact row of small cards. One item = just
 *                the spotlight. Only layout changes; all styling via CSS vars.
 */

type TestimonialsData = BlockProps["testimonials"];

// "" — the original two-column card grid, extracted unchanged.
function TestimonialsDefault({ data }: { data: TestimonialsData }) {
  const { title, items } = data;
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

        <ul className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {items.map((item, index) => (
            <li
              key={index}
              className="flex flex-col gap-4 rounded-[var(--radius)] p-8"
              style={{
                backgroundColor: "var(--color-accent)",
                borderLeft: "4px solid var(--color-primary)",
              }}
            >
              <blockquote
                className="text-lg leading-relaxed"
                style={{ color: "var(--color-foreground)" }}
              >
                &ldquo;{item.quote}&rdquo;
              </blockquote>

              <footer className="mt-auto">
                <p
                  className="font-semibold"
                  style={{ color: "var(--color-foreground)" }}
                >
                  {item.author}
                </p>
                {item.role && (
                  <p
                    className="text-sm"
                    style={{ color: "var(--color-muted-foreground)" }}
                  >
                    {item.role}
                  </p>
                )}
              </footer>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// "spotlight" — first item as a big centred pull-quote, rest as a compact row.
function TestimonialsSpotlight({ data }: { data: TestimonialsData }) {
  const { title, items } = data;
  const [featured, ...rest] = items;
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
            className="mb-12 text-center text-3xl font-bold md:text-4xl"
            style={{ fontFamily: "var(--font-heading)", color: "var(--color-foreground)" }}
          >
            {title}
          </h2>
        )}

        <figure className="mx-auto max-w-3xl text-center">
          <span
            aria-hidden="true"
            className="block text-6xl font-bold leading-none"
            style={{ fontFamily: "var(--font-heading)", color: "var(--color-primary)" }}
          >
            &ldquo;
          </span>
          <blockquote
            className="mt-4 text-xl italic leading-relaxed md:text-2xl"
            style={{ color: "var(--color-foreground)" }}
          >
            {featured.quote}
          </blockquote>
          <figcaption className="mt-6">
            <p className="font-semibold" style={{ color: "var(--color-foreground)" }}>
              {featured.author}
            </p>
            {featured.role && (
              <p className="text-sm" style={{ color: "var(--color-muted-foreground)" }}>
                {featured.role}
              </p>
            )}
          </figcaption>
        </figure>

        {rest.length > 0 && (
          <ul className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((item, index) => (
              <li
                key={index}
                className="flex flex-col gap-4 rounded-[var(--radius)] p-6"
                style={{ backgroundColor: "var(--color-accent)" }}
              >
                <blockquote
                  className="text-base leading-relaxed"
                  style={{ color: "var(--color-foreground)" }}
                >
                  &ldquo;{item.quote}&rdquo;
                </blockquote>
                <div className="mt-auto">
                  <p
                    className="text-sm font-semibold"
                    style={{ color: "var(--color-foreground)" }}
                  >
                    {item.author}
                  </p>
                  {item.role && (
                    <p
                      className="text-xs"
                      style={{ color: "var(--color-muted-foreground)" }}
                    >
                      {item.role}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export default function Testimonials({
  data,
  skin,
}: {
  data: TestimonialsData;
  skin?: string;
}) {
  if (skin === "spotlight") return <TestimonialsSpotlight data={data} />;
  return <TestimonialsDefault data={data} />;
}
