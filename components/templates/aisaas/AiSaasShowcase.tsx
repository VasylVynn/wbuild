import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Showcase — a `switchback` block rendered as feature-spotlight rows: a large
 * rounded-3xl photo sitting over a soft pastel glow, paired with a prose column,
 * the pair mirroring left/right on each successive row (lg only). This is the
 * product-led "feature deep-dive" that follows the bento highlights — distinct
 * from the flat testimonials grid and the numbered process rail. §4.8: the photo
 * comes from props ONLY; a row without one degrades to a soft lavender→peach
 * decorative panel (never a broken <img>). Optional coral arrow link per row.
 * Plain server component.
 *
 * Default: full-width alternating rows.
 * `cards` variant: compact image-top tiles in a responsive grid.
 */
type Item = BlockProps["switchback"]["items"][number];

// A row/card photo, or a soft pastel decorative panel when the item has no
// image. The caller owns shape/size via `className`.
function ShowcaseMedia({ item, className }: { item: Item; className: string }) {
  if (item.imageUrl) {
    return (
      <img src={item.imageUrl} alt={item.heading} className={`relative w-full object-cover ${className}`} />
    );
  }
  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-br from-[#D3E4FD] to-[#FDE1D3] ${className}`}
      aria-hidden="true"
    >
      <div className="absolute -left-10 -top-10 h-48 w-48 rounded-full bg-white/40 blur-3xl" />
      <div className="absolute -bottom-12 -right-8 h-56 w-56 rounded-full bg-[#F1F0FB] blur-3xl" />
    </div>
  );
}

// Coral inline arrow link shared by both layouts.
function ShowcaseLink({ label, href }: { label: string; href?: string }) {
  return (
    <a
      href={href ?? "#"}
      className="mt-6 inline-flex items-center gap-2 font-semibold text-[#E07A5F] transition-colors hover:text-[#E07A5F]/80"
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

function ShowcaseHeader({ title }: { title?: string }) {
  if (!title) return null;
  return (
    <div className="mx-auto mb-14 max-w-2xl text-center">
      <span className="mb-3 inline-block text-sm font-semibold text-[#E07A5F]">У фокусі</span>
      <h2 className="text-3xl font-bold text-[#2F4550] md:text-4xl">{title}</h2>
    </div>
  );
}

export default function AiSaasShowcase({ data }: { data: unknown }) {
  const d = data as BlockProps["switchback"];

  return (
    <section className="bg-white py-16">
      <div className="mx-auto max-w-6xl px-4">
        <ShowcaseHeader title={d.title} />

        <div className="space-y-16 sm:space-y-20">
          {d.items.map((item, i) => (
            <div
              key={i}
              className={`flex flex-col gap-8 lg:flex-row lg:items-center lg:gap-16 ${
                i % 2 === 1 ? "lg:flex-row-reverse" : ""
              }`}
            >
              <div className="lg:w-1/2">
                <div className="relative">
                  <div
                    className="absolute -inset-4 rounded-[2.5rem] bg-gradient-to-tr from-[#D3E4FD] to-[#FDE1D3] blur-2xl"
                    aria-hidden="true"
                  />
                  <ShowcaseMedia
                    item={item}
                    className="aspect-4/3 rounded-3xl shadow-[0_10px_30px_-12px_rgba(47,69,80,0.35)]"
                  />
                </div>
              </div>
              <div className="lg:w-1/2">
                <h3 className="text-2xl font-bold text-[#2F4550] md:text-3xl">{item.heading}</h3>
                <p className="mt-4 leading-relaxed text-[#2F4550]/80">{item.body}</p>
                {item.buttonLabel && <ShowcaseLink label={item.buttonLabel} href={item.buttonHref} />}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function AiSaasShowcaseCards({ data }: { data: unknown }) {
  const d = data as BlockProps["switchback"];

  return (
    <section className="bg-white py-16">
      <div className="mx-auto max-w-6xl px-4">
        <ShowcaseHeader title={d.title} />

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {d.items.map((item, i) => (
            <div
              key={i}
              className="group flex h-full flex-col overflow-hidden rounded-3xl bg-[#F1F0FB] shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
            >
              <ShowcaseMedia item={item} className="h-52" />
              <div className="flex flex-1 flex-col p-6 sm:p-8">
                <h3 className="text-xl font-bold text-[#2F4550]">{item.heading}</h3>
                <p className="mt-3 flex-1 leading-relaxed text-[#2F4550]/80">{item.body}</p>
                {item.buttonLabel && <ShowcaseLink label={item.buttonLabel} href={item.buttonHref} />}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
