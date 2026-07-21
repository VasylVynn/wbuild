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
