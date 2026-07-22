import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Testimonials — real customer words (never invented). Author avatars are
 * initials chips (no fabricated photos).
 *
 * Default: glass cards grid.
 * `spotlight` variant: large centred quotes stacked, each with a brand quote
 * mark — for a few strong, longer testimonials.
 */
function Initials({ name, className = "" }: { name: string; className?: string }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-full border border-[var(--launch-border)] bg-[var(--launch-input)] font-semibold text-[var(--launch-brand)] ${className}`}>
      {initials}
    </span>
  );
}

function Header({ title }: { title?: string }) {
  if (!title) return null;
  return (
    <h2 className="launch-appear mx-auto mb-14 max-w-2xl text-balance text-center text-3xl font-bold sm:text-5xl">
      {title}
    </h2>
  );
}

export default function LaunchTestimonials({ data }: { data: unknown }) {
  const d = data as BlockProps["testimonials"];

  return (
    <section className="relative px-4 py-20 sm:px-6 md:py-28">
      <div className="mx-auto max-w-6xl">
        <Header title={d.title} />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {d.items.map((item, i) => (
            <figure key={i} className="launch-glass flex flex-col rounded-2xl p-6">
              <blockquote className="flex-1 text-[15px] leading-relaxed text-[var(--launch-fg)]">
                “{item.quote}”
              </blockquote>
              <figcaption className="mt-6 flex items-center gap-3">
                <Initials name={item.author} className="h-10 w-10 text-sm" />
                <div>
                  <div className="text-sm font-semibold text-[var(--launch-fg)]">{item.author}</div>
                  {item.role && <div className="text-xs text-[var(--launch-muted)]">{item.role}</div>}
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LaunchTestimonialsSpotlight({ data }: { data: unknown }) {
  const d = data as BlockProps["testimonials"];

  return (
    <section className="relative overflow-hidden px-4 py-20 sm:px-6 md:py-28">
      <div className="launch-glow launch-glow--center" aria-hidden="true" />
      <div className="relative z-10 mx-auto max-w-3xl">
        <Header title={d.title} />
        <div className="space-y-6">
          {d.items.map((item, i) => (
            <figure key={i} className="launch-glass rounded-3xl p-8 text-center sm:p-10">
              <span className="text-5xl font-extrabold leading-none text-[var(--launch-brand)]" aria-hidden="true">“</span>
              <blockquote className="mt-2 text-balance text-lg font-medium leading-relaxed text-[var(--launch-fg)] sm:text-xl">
                {item.quote}
              </blockquote>
              <figcaption className="mt-6 flex items-center justify-center gap-3">
                <Initials name={item.author} className="h-11 w-11 text-sm" />
                <div className="text-left">
                  <div className="text-sm font-semibold text-[var(--launch-fg)]">{item.author}</div>
                  {item.role && <div className="text-xs text-[var(--launch-muted)]">{item.role}</div>}
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Ukrainian count-noun agreement for the review tally. */
function pluralUk(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

/*
 * `ledger` variant — a "summary + quotes" split: a sticky title rail with the
 * real review tally on the left, and the quotes as full-width stacked ROWS
 * (divided, not carded) on the right. Distinct from the base card grid: split
 * axis, list-vs-grid density and an added summary panel.
 */
export function LaunchTestimonialsLedger({ data }: { data: unknown }) {
  const d = data as BlockProps["testimonials"];
  const count = d.items.length;

  return (
    <section className="relative px-4 py-20 sm:px-6 md:py-28">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-12 lg:gap-14">
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-24">
            <span className="text-6xl font-extrabold leading-none text-[var(--launch-brand)]" aria-hidden="true">“</span>
            {d.title && (
              <h2 className="mt-3 text-3xl font-bold text-[var(--launch-fg)] sm:text-4xl">{d.title}</h2>
            )}
            {count > 0 && (
              <p className="mt-5 text-sm text-[var(--launch-muted)]">
                <span className="launch-gradient-text text-2xl font-extrabold">{count}</span>{" "}
                {pluralUk(count, "справжній відгук", "справжні відгуки", "справжніх відгуків")}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col divide-y divide-[var(--launch-border)] lg:col-span-8">
          {d.items.map((item, i) => (
            <figure key={i} className="py-7 first:pt-0 last:pb-0">
              <blockquote className="text-lg leading-relaxed text-[var(--launch-fg)]">“{item.quote}”</blockquote>
              <figcaption className="mt-4 flex items-center gap-3">
                <Initials name={item.author} className="h-10 w-10 text-sm" />
                <div>
                  <div className="text-sm font-semibold text-[var(--launch-fg)]">{item.author}</div>
                  {item.role && <div className="text-xs text-[var(--launch-muted)]">{item.role}</div>}
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
