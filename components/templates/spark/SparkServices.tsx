import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Services — the source's card grid: hairline-bordered cards on the canvas,
 * medium name, muted description, a mono price accent and an optional badge.
 * DEFAULT is a responsive grid; the "list" variant is a single stacked column
 * with the price pinned right (a price-list read).
 */

function SectionHead({ title }: { title?: string }) {
  if (!title) return null;
  return (
    <div className="mx-auto mb-12 max-w-2xl text-center">
      <p className="spark-eyebrow mb-3">Послуги</p>
      <h2 className="text-3xl text-[var(--spark-fg)] md:text-4xl">{title}</h2>
    </div>
  );
}

function Badge({ label }: { label?: string }) {
  if (!label) return null;
  return (
    <span className="spark-mono rounded-full border border-[var(--spark-border)] px-2.5 py-0.5 text-[0.6875rem] uppercase tracking-wide text-[var(--spark-muted-fg)]">
      {label}
    </span>
  );
}

export default function SparkServices({ data }: { data: unknown }) {
  const d = data as BlockProps["services"];

  return (
    <section id="services" className="bg-[var(--spark-bg)] px-4 py-16 sm:px-6 md:py-24 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <SectionHead title={d.title} />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {d.items.map((item, i) => (
            <div key={i} className="spark-card flex flex-col p-6">
              <div className="mb-3 flex items-start justify-between gap-3">
                <h3 className="text-lg text-[var(--spark-fg)]">{item.name}</h3>
                <Badge label={item.badge} />
              </div>
              {item.description && (
                <p className="flex-1 text-sm leading-relaxed text-[var(--spark-muted-fg)]">{item.description}</p>
              )}
              {item.price && <p className="spark-mono mt-4 text-sm text-[var(--spark-fg)]">{item.price}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/*
 * Variant "list" — a stacked price-list: each row is a hairline-separated line
 * with the name/description left and the price right.
 */
export function SparkServicesList({ data }: { data: unknown }) {
  const d = data as BlockProps["services"];

  return (
    <section id="services" className="bg-[var(--spark-bg)] px-4 py-16 sm:px-6 md:py-24 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <SectionHead title={d.title} />
        <ul className="divide-y divide-[var(--spark-border)] border-y border-[var(--spark-border)]">
          {d.items.map((item, i) => (
            <li key={i} className="flex items-start justify-between gap-6 py-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base text-[var(--spark-fg)]">{item.name}</h3>
                  <Badge label={item.badge} />
                </div>
                {item.description && (
                  <p className="mt-1 text-sm leading-relaxed text-[var(--spark-muted-fg)]">{item.description}</p>
                )}
              </div>
              {item.price && <p className="spark-mono shrink-0 text-sm text-[var(--spark-fg)]">{item.price}</p>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/*
 * Variant "bento" — an asymmetric mosaic instead of the base's uniform card
 * grid: the first service becomes a large featured cell (2×2 from sm up) with
 * the remaining services as standard 1×1 cells around it. Same hairline-card
 * idiom, but a mixed-span rhythm and a promoted lead item — not equal tiles.
 */
export function SparkServicesBento({ data }: { data: unknown }) {
  const d = data as BlockProps["services"];

  return (
    <section id="services" className="bg-[var(--spark-bg)] px-4 py-16 sm:px-6 md:py-24 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <SectionHead title={d.title} />
        <div className="grid auto-rows-[minmax(11rem,1fr)] grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {d.items.map((item, i) => {
            const featured = i === 0;
            return (
              <div
                key={i}
                className={`spark-card flex flex-col p-6 ${featured ? "sm:col-span-2 sm:row-span-2 md:p-8" : ""}`}
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <h3 className={featured ? "text-2xl text-[var(--spark-fg)]" : "text-lg text-[var(--spark-fg)]"}>
                    {item.name}
                  </h3>
                  <Badge label={item.badge} />
                </div>
                {item.description && (
                  <p className="flex-1 text-sm leading-relaxed text-[var(--spark-muted-fg)]">{item.description}</p>
                )}
                {item.price && <p className="spark-mono mt-4 text-sm text-[var(--spark-fg)]">{item.price}</p>}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
