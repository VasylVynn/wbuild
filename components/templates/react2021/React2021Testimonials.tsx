import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Testimonials — no dedicated testimonials section in the react-2021
 * source; designed fresh from its Features/Product palette (coral kicker,
 * extrabold dark-ink heading, thin coral divider bar) with gray-50 cards.
 * Same field usage as AiSaasTestimonials (optional title + items[].quote/
 * author/role). `testimonials` items carry no avatar field, so every card
 * renders a coral-tint initials badge instead of a photo — no next/image,
 * same convention as NextlyTestimonials.
 */
function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export default function React2021Testimonials({ data }: { data: unknown }) {
  const d = data as BlockProps["testimonials"];

  return (
    <section className="bg-white py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <span className="text-sm font-semibold uppercase tracking-wide text-[#ec4755]">
            Відгуки
          </span>
          <p className="mt-2 text-3xl font-extrabold tracking-tight text-[#1a2e35] sm:text-4xl">
            {d.title ?? "Що кажуть наші клієнти"}
          </p>
          <div className="mx-auto mt-4 h-1 w-24 rounded-t bg-[#ec4755] opacity-25" />
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {d.items.map((item, i) => (
            <div key={i} className="flex h-full flex-col rounded-xl bg-gray-50 p-8 shadow-sm">
              <p className="flex-1 leading-relaxed text-[#1a2e35]">{item.quote}</p>

              <div className="mt-6 flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#ec4755]/10 text-sm font-semibold text-[#ec4755]">
                  {initials(item.author)}
                </div>
                <div>
                  <p className="font-bold text-[#1a2e35]">{item.author}</p>
                  {item.role && <p className="text-sm text-gray-500">{item.role}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
