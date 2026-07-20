import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Switchback — alternating "photo + text" storytelling rows (zig-zag): the
 * kitchen, the produce, the "from-farm-to-table" journey. Each row pairs a
 * warm rounded image with a serif heading, taupe body and an optional inline
 * arrow link. Rows flip side every other item (lg only). §4.8: images come
 * only from props — a missing photo degrades to a decorative cream→sand panel
 * with soft terracotta/olive blobs (mirrors RestaurantHero's fallback), never
 * a broken <img>. Plain server component.
 *
 * Default: full-width alternating rows.
 * `stacked` variant: compact image-top cards in a responsive grid.
 */
type Item = BlockProps["switchback"]["items"][number];

// A row/card photo, or a warm decorative panel when the item has no image.
// The caller owns shape/shadow/size via `className` (the row rounds + shadows
// its media; the stacked card lets its own clip do it).
function SwitchbackMedia({ item, className }: { item: Item; className: string }) {
  if (item.imageUrl) {
    return <img src={item.imageUrl} alt={item.heading} className={`w-full object-cover ${className}`} />;
  }
  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-br from-[#F3EADD] to-[#FBF6EF] ${className}`}
    >
      <div className="absolute -left-10 -top-10 h-48 w-48 rounded-full bg-[#C0562F]/20 blur-3xl" />
      <div className="absolute -bottom-10 -right-8 h-56 w-56 rounded-full bg-[#5F6F3E]/20 blur-3xl" />
    </div>
  );
}

// Terracotta inline arrow link shared by both layouts.
function SwitchbackLink({ label, href }: { label: string; href?: string }) {
  return (
    <a
      href={href ?? "#"}
      className="mt-6 inline-flex items-center gap-2 font-semibold text-[#C0562F] transition-colors hover:text-[#9E4423]"
    >
      {label}
      <svg
        className="h-[18px] w-[18px]"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
      </svg>
    </a>
  );
}

function SwitchbackHeader({ title }: { title?: string }) {
  if (!title) return null;
  return (
    <div className="mx-auto mb-14 max-w-2xl text-center">
      <h2 className="text-3xl font-bold text-[#2A2018] md:text-4xl">{title}</h2>
    </div>
  );
}

export default function RestaurantSwitchback({ data }: { data: unknown }) {
  const d = data as BlockProps["switchback"];

  return (
    <section className="bg-[#FBF6EF] py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SwitchbackHeader title={d.title} />

        <div className="space-y-16 sm:space-y-20">
          {d.items.map((item, i) => (
            <div
              key={i}
              className={`flex flex-col gap-8 lg:flex-row lg:items-center lg:gap-16 ${
                i % 2 === 1 ? "lg:flex-row-reverse" : ""
              }`}
            >
              <div className="lg:w-1/2">
                <SwitchbackMedia
                  item={item}
                  className="aspect-4/3 rounded-2xl shadow-[0_10px_30px_-12px_rgba(42,32,24,0.35)]"
                />
              </div>
              <div className="lg:w-1/2">
                <h3 className="text-2xl font-bold text-[#2A2018] md:text-3xl">{item.heading}</h3>
                <p className="mt-4 leading-relaxed text-[#6F6257]">{item.body}</p>
                {item.buttonLabel && (
                  <SwitchbackLink label={item.buttonLabel} href={item.buttonHref} />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function RestaurantSwitchbackStacked({ data }: { data: unknown }) {
  const d = data as BlockProps["switchback"];

  return (
    <section className="bg-[#FBF6EF] py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SwitchbackHeader title={d.title} />

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {d.items.map((item, i) => (
            <div
              key={i}
              className="flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-[0_4px_24px_rgba(42,32,24,0.08)]"
            >
              <SwitchbackMedia item={item} className="h-52" />
              <div className="flex flex-1 flex-col p-6">
                <h3 className="text-xl font-semibold text-[#2A2018]">{item.heading}</h3>
                <p className="mt-3 flex-1 leading-relaxed text-[#6F6257]">{item.body}</p>
                {item.buttonLabel && (
                  <SwitchbackLink label={item.buttonLabel} href={item.buttonHref} />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
