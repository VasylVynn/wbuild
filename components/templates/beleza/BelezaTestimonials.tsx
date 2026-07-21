import type { BlockProps } from "@/lib/blocks/schema";
import { Reveal } from "@/components/templates/shared/reveal";
import { StarIcon } from "./icons";

/*
 * Testimonials — real clients' words (a fact, never invented). Two layouts:
 *
 * Default:  soft cards with a five-star row, the quote, and an initials avatar.
 * `grid`:   an editorial two-column layout led by a big rose quotation mark.
 */
type TestimonialsData = BlockProps["testimonials"];
type Item = TestimonialsData["items"][number];

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function Avatar({ item }: { item: Item }) {
  return (
    <div className="mt-4 flex items-center gap-3 border-t pt-4" style={{ borderColor: "var(--beleza-border-subtle)" }}>
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
        style={{ background: "var(--beleza-branding)" }}
      >
        {initials(item.author)}
      </span>
      <div className="min-w-0">
        <p className="beleza-ink truncate text-sm font-semibold">{item.author}</p>
        {item.role && <p className="beleza-muted truncate text-xs">{item.role}</p>}
      </div>
    </div>
  );
}

function Header({ title }: { title?: string }) {
  if (!title) return null;
  return (
    <Reveal className="mb-12 md:mb-16">
      <h2 className="beleza-kicker">
        <strong>{title}</strong> Те, що клієнтки розповідають про свій досвід у нас.
      </h2>
    </Reveal>
  );
}

export default function BelezaTestimonials({ data }: { data: unknown }) {
  const d = data as TestimonialsData;

  return (
    <section id="testimonials" className="beleza-section">
      <div className="beleza-container">
        <Header title={d.title} />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3 md:gap-6">
          {d.items.map((item, i) => (
            <Reveal key={i} delay={i * 0.05}>
              <figure className="beleza-card beleza-card--hover h-full">
                <div className="flex gap-0.5 text-[color:var(--beleza-branding)]">
                  {Array.from({ length: 5 }).map((_, s) => (
                    <StarIcon key={s} className="h-3.5 w-3.5" />
                  ))}
                </div>
                <blockquote className="beleza-muted mt-3 flex-1 text-sm leading-relaxed">“{item.quote}”</blockquote>
                <Avatar item={item} />
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/*
 * `rail` variant — a single-column «стрічка цитат»: each testimonial is a row
 * on a continuous vertical rail, led by a big index number (01, 02…) and a
 * dashed rose rule (the beleza signature). Distinct from the base card grid:
 * one column instead of three, a ruled-list density instead of cards, and
 * left-aligned large quotes.
 */
export function BelezaTestimonialsRail({ data }: { data: unknown }) {
  const d = data as TestimonialsData;

  return (
    <section id="testimonials" className="beleza-section">
      <div className="beleza-container max-w-3xl">
        <Header title={d.title} />
        <ol className="mt-4 flex flex-col">
          {d.items.map((item, i) => (
            <li
              key={i}
              className="grid gap-4 border-dashed py-8 first:border-t-0 sm:grid-cols-[auto_1fr] sm:gap-6"
              style={{ borderTop: i === 0 ? undefined : "1px dashed var(--beleza-brand-1-strong)" }}
            >
              <span
                className="beleza-accent text-3xl font-bold leading-none sm:text-4xl"
                style={{ fontFamily: "var(--beleza-display)" }}
                aria-hidden="true"
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <blockquote className="beleza-ink text-lg leading-relaxed sm:text-xl">“{item.quote}”</blockquote>
                <footer className="beleza-muted mt-3 text-sm">
                  <span className="beleza-ink font-semibold">{item.author}</span>
                  {item.role && <span> · {item.role}</span>}
                </footer>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function BelezaTestimonialsGrid({ data }: { data: unknown }) {
  const d = data as TestimonialsData;

  return (
    <section id="testimonials" className="beleza-section beleza-tint">
      <div className="beleza-container">
        <Header title={d.title} />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6">
          {d.items.map((item, i) => (
            <Reveal key={i} delay={i * 0.05}>
              <figure className="beleza-card h-full">
                <span className="text-4xl leading-none text-[color:var(--beleza-branding)]" style={{ fontFamily: "var(--beleza-display)" }} aria-hidden="true">
                  “
                </span>
                <blockquote className="beleza-ink mt-1 flex-1 text-base leading-relaxed">{item.quote}</blockquote>
                <figcaption className="mt-4 flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: "var(--beleza-branding)" }}>
                    {initials(item.author)}
                  </span>
                  <div className="min-w-0">
                    <p className="beleza-ink truncate text-sm font-semibold">{item.author}</p>
                    {item.role && <p className="beleza-muted truncate text-xs">{item.role}</p>}
                  </div>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
