import type { BlockProps } from "@/lib/blocks/schema";

// Initials fallback avatar — first letters of up to two name parts, e.g. "Марія Коваль" → "МК".
function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

/*
 * Testimonials — warm rounded white cards on the cream canvas, each led by
 * a soft terracotta quote-mark glyph, the guest's quote in ink, and an
 * initials badge (schema carries no avatar field) + serif author name +
 * taupe role. Mirrors AiSaasTestimonials's structure; no star ratings —
 * the `testimonials` schema has no rating field.
 */
export default function RestaurantTestimonials({ data }: { data: unknown }) {
  const d = data as BlockProps["testimonials"];

  return (
    <section className="py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-[#2A2018] md:text-4xl">
            {d.title ?? "What our guests say"}
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {d.items.map((item, i) => (
            <div
              key={i}
              className="flex h-full flex-col rounded-2xl bg-white p-8 shadow-[0_4px_24px_rgba(42,32,24,0.08)]"
            >
              <svg
                className="h-8 w-8 text-[#C0562F]"
                fill="currentColor"
                viewBox="0 0 32 32"
                aria-hidden="true"
              >
                <path d="M10 8c-3.3 0-6 2.7-6 6v10h10V14H8c0-1.1.9-2 2-2V8Zm14 0c-3.3 0-6 2.7-6 6v10h10V14h-6c0-1.1.9-2 2-2V8Z" />
              </svg>

              <p className="mt-4 flex-1 leading-relaxed text-[#2A2018]">{item.quote}</p>

              <div className="mt-6 flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F3EADD] text-sm font-semibold text-[#C0562F]">
                  {initials(item.author)}
                </div>
                <div>
                  <p className="font-semibold text-[#2A2018]">{item.author}</p>
                  {item.role && <p className="text-sm text-[#6F6257]">{item.role}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
