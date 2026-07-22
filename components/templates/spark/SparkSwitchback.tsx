import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Switchback — a direct port of the source's split-section: alternating
 * image/text rows (zig-zag). Each row has a framed image on one side (reversed
 * on odd rows) and a heading + relaxed body + optional arrow link on the other.
 * No photo → a quiet token-tinted panel (§4.8 — never a broken box).
 */

function Panel({ url, alt }: { url?: string; alt: string }) {
  if (url) {
    return (
      <div className="overflow-hidden rounded-[var(--spark-radius)] border border-[var(--spark-border)] bg-[var(--spark-card)]">
        <img src={url} alt={alt} className="aspect-[4/3] h-auto w-full object-cover" />
      </div>
    );
  }
  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--spark-radius)] border border-[var(--spark-border)] bg-[var(--spark-muted)]">
      <div
        className="absolute inset-0 opacity-[0.5]"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--spark-border) 1px, transparent 1px), linear-gradient(to bottom, var(--spark-border) 1px, transparent 1px)",
          backgroundSize: "36px 36px",
        }}
      />
    </div>
  );
}

/* Borderless media for the "cards" variant (the card owns the frame). */
function CardMedia({ url, alt }: { url?: string; alt: string }) {
  if (url) {
    return <img src={url} alt={alt} className="aspect-[4/3] w-full object-cover" />;
  }
  return (
    <div className="relative aspect-[4/3] bg-[var(--spark-muted)]">
      <div
        className="absolute inset-0 opacity-[0.5]"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--spark-border) 1px, transparent 1px), linear-gradient(to bottom, var(--spark-border) 1px, transparent 1px)",
          backgroundSize: "36px 36px",
        }}
      />
    </div>
  );
}

export default function SparkSwitchback({ data }: { data: unknown }) {
  const d = data as BlockProps["switchback"];

  return (
    <section className="bg-[var(--spark-bg)] px-4 py-16 sm:px-6 md:py-24 lg:px-8">
      <div className="mx-auto max-w-6xl">
        {d.title && (
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <h2 className="text-3xl text-[var(--spark-fg)] md:text-4xl">{d.title}</h2>
          </div>
        )}
        <div className="space-y-16 md:space-y-24">
          {d.items.map((item, i) => {
            const reversed = i % 2 === 1;
            return (
              <div key={i} className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
                <div className={reversed ? "lg:order-2" : ""}>
                  <Panel url={item.imageUrl} alt={item.heading} />
                </div>
                <div className={reversed ? "lg:order-1" : ""}>
                  <h3 className="text-2xl text-[var(--spark-fg)] md:text-3xl">{item.heading}</h3>
                  <p className="mt-4 text-lg leading-relaxed text-[var(--spark-muted-fg)]">{item.body}</p>
                  {item.buttonLabel && (
                    <a
                      href={item.buttonHref ?? "#lead_form"}
                      className="spark-mono mt-6 inline-flex items-center gap-1.5 text-sm text-[var(--spark-fg)] transition-opacity hover:opacity-70"
                    >
                      {item.buttonLabel}
                      <span aria-hidden="true">→</span>
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

/*
 * Variant "cards" — the same steps as self-contained hairline cards in a
 * responsive grid (no zig-zag): each card stacks a framed photo (or quiet grid
 * panel, §4.8) over a mono running index, heading, body and optional arrow link.
 */
export function SparkSwitchbackCards({ data }: { data: unknown }) {
  const d = data as BlockProps["switchback"];

  return (
    <section className="bg-[var(--spark-bg)] px-4 py-16 sm:px-6 md:py-24 lg:px-8">
      <div className="mx-auto max-w-6xl">
        {d.title && (
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <h2 className="text-3xl text-[var(--spark-fg)] md:text-4xl">{d.title}</h2>
          </div>
        )}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {d.items.map((item, i) => (
            <article
              key={i}
              className="flex flex-col overflow-hidden rounded-[var(--spark-radius)] border border-[var(--spark-border)] bg-[var(--spark-card)]"
            >
              <CardMedia url={item.imageUrl} alt={item.heading} />
              <div className="flex flex-1 flex-col p-6">
                <span className="spark-mono text-xs text-[var(--spark-muted-fg)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-2 text-xl text-[var(--spark-fg)]">{item.heading}</h3>
                <p className="mt-3 flex-1 leading-relaxed text-[var(--spark-muted-fg)]">{item.body}</p>
                {item.buttonLabel && (
                  <a
                    href={item.buttonHref ?? "#lead_form"}
                    className="spark-mono mt-5 inline-flex items-center gap-1.5 text-sm text-[var(--spark-fg)] transition-opacity hover:opacity-70"
                  >
                    {item.buttonLabel}
                    <span aria-hidden="true">→</span>
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
