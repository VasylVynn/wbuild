import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Testimonials — the source's social-proof, quietly restyled. DEFAULT: a grid
 * of hairline quote cards (quote, initials avatar, name, role). Variant "quote":
 * a single centred oversized pull-quote per row (stacked), for a few strong
 * voices. Only real customer words (a fact — never invented).
 */

function Initials({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--spark-border)] bg-[var(--spark-muted)]">
      <span className="spark-mono text-xs text-[var(--spark-fg)]">{initials}</span>
    </div>
  );
}

export default function SparkTestimonials({ data }: { data: unknown }) {
  const d = data as BlockProps["testimonials"];

  return (
    <section id="testimonials" className="bg-[var(--spark-bg)] px-4 py-16 sm:px-6 md:py-24 lg:px-8">
      <div className="mx-auto max-w-6xl">
        {d.title && (
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <p className="spark-eyebrow mb-3">Відгуки</p>
            <h2 className="text-3xl text-[var(--spark-fg)] md:text-4xl">{d.title}</h2>
          </div>
        )}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {d.items.map((item, i) => (
            <figure key={i} className="spark-card flex flex-col p-6">
              <blockquote className="flex-1 text-[var(--spark-fg)]">
                <p className="leading-relaxed">“{item.quote}”</p>
              </blockquote>
              <figcaption className="mt-6 flex items-center gap-3">
                <Initials name={item.author} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--spark-fg)]">{item.author}</p>
                  {item.role && <p className="truncate text-xs text-[var(--spark-muted-fg)]">{item.role}</p>}
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/*
 * Variant "quote" — a few strong voices as centred oversized pull-quotes,
 * hairline-separated.
 */
export function SparkTestimonialsQuote({ data }: { data: unknown }) {
  const d = data as BlockProps["testimonials"];

  return (
    <section id="testimonials" className="bg-[var(--spark-bg)] px-4 py-16 sm:px-6 md:py-24 lg:px-8">
      <div className="mx-auto max-w-3xl">
        {d.title && (
          <div className="mb-12 text-center">
            <p className="spark-eyebrow mb-3">Відгуки</p>
            <h2 className="text-3xl text-[var(--spark-fg)] md:text-4xl">{d.title}</h2>
          </div>
        )}
        <div className="divide-y divide-[var(--spark-border)]">
          {d.items.map((item, i) => (
            <figure key={i} className="py-10 text-center first:pt-0 last:pb-0">
              <blockquote>
                <p className="text-xl leading-relaxed text-[var(--spark-fg)] md:text-2xl">“{item.quote}”</p>
              </blockquote>
              <figcaption className="mt-5">
                <span className="text-sm font-medium text-[var(--spark-fg)]">{item.author}</span>
                {item.role && <span className="text-sm text-[var(--spark-muted-fg)]"> · {item.role}</span>}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
