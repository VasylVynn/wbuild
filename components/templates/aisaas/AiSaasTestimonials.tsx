import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Testimonials — port of the source testimonial section's card layout
 * (star ratings dropped: `testimonials` items carry no rating field).
 * Header + responsive grid of soft rounded-3xl white cards, each led by
 * an inline coral quote-mark SVG (source used a lucide/text glyph icon).
 * A static grid, not a carousel — no client component needed.
 */
export default function AiSaasTestimonials({ data }: { data: unknown }) {
  const d = data as BlockProps["testimonials"];

  return (
    <section className="py-16">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-[#2F4550] md:text-4xl">
            {d.title ?? "Loved by teams everywhere"}
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {d.items.map((item, i) => (
            <div
              key={i}
              className="flex h-full flex-col rounded-3xl bg-white p-8 shadow-[0_4px_24px_rgba(47,69,80,0.08)]"
            >
              <svg
                className="h-8 w-8 text-[#E07A5F]"
                fill="currentColor"
                viewBox="0 0 32 32"
                aria-hidden="true"
              >
                <path d="M10 8c-3.3 0-6 2.7-6 6v10h10V14H8c0-1.1.9-2 2-2V8Zm14 0c-3.3 0-6 2.7-6 6v10h10V14h-6c0-1.1.9-2 2-2V8Z" />
              </svg>

              <p className="mt-4 flex-1 leading-relaxed text-[#2F4550]/90">{item.quote}</p>

              <div className="mt-6">
                <p className="font-semibold text-[#2F4550]">{item.author}</p>
                {item.role && <p className="text-sm text-[#2F4550]/60">{item.role}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/*
 * `feature` variant — one testimonial promoted to a large pastel panel on the
 * left, the rest as a compact divided LIST on the right. Distinct from the
 * base uniform grid: an asymmetric featured+list density, a split axis and a
 * reordered emphasis (first item promoted).
 */
export function AiSaasTestimonialsFeature({ data }: { data: unknown }) {
  const d = data as BlockProps["testimonials"];
  const [featured, ...rest] = d.items;

  if (!featured) return null;

  return (
    <section className="py-16">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-[#2F4550] md:text-4xl">
            {d.title ?? "Що кажуть клієнти"}
          </h2>
        </div>

        <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
          <figure className="flex flex-col rounded-3xl bg-[#F1F0FB] p-8 md:p-10 lg:col-span-5">
            <svg className="h-10 w-10 text-[#E07A5F]" fill="currentColor" viewBox="0 0 32 32" aria-hidden="true">
              <path d="M10 8c-3.3 0-6 2.7-6 6v10h10V14H8c0-1.1.9-2 2-2V8Zm14 0c-3.3 0-6 2.7-6 6v10h10V14h-6c0-1.1.9-2 2-2V8Z" />
            </svg>
            <blockquote className="mt-4 text-xl font-medium leading-relaxed text-[#2F4550] md:text-2xl">
              {featured.quote}
            </blockquote>
            <figcaption className="mt-6">
              <p className="font-semibold text-[#2F4550]">{featured.author}</p>
              {featured.role && <p className="text-sm text-[#2F4550]/60">{featured.role}</p>}
            </figcaption>
          </figure>

          {rest.length > 0 && (
            <div className="flex flex-col divide-y divide-[#2F4550]/10 lg:col-span-7">
              {rest.map((item, i) => (
                <figure key={i} className="py-6 first:pt-0 last:pb-0">
                  <blockquote className="leading-relaxed text-[#2F4550]/90">“{item.quote}”</blockquote>
                  <figcaption className="mt-3">
                    <span className="font-semibold text-[#2F4550]">{item.author}</span>
                    {item.role && <span className="text-sm text-[#2F4550]/60"> · {item.role}</span>}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
