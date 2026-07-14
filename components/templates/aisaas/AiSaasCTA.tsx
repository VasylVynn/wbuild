import type { BlockProps } from "@/lib/blocks/schema";

/*
 * CTA — restyled port of the source cta.tsx promo banner. The source is a
 * grey box with a green diagonal-clip accent and a lucide Megaphone button;
 * here it's a soft-pastel lavender-to-peach gradient band (matching the
 * hero's rounded-3xl language) with a coral pill button. Megaphone icon
 * dropped per the no-lucide rule — an inline arrow SVG stands in.
 */
export default function AiSaasCTA({ data }: { data: unknown }) {
  const d = data as BlockProps["cta"];

  return (
    <section className="py-16">
      <div className="mx-auto max-w-4xl px-4">
        <div className="rounded-3xl bg-gradient-to-br from-[#D3E4FD] to-[#FDE1D3] px-6 py-14 text-center md:px-16 md:py-16">
          <h2 className="mb-4 text-3xl font-bold text-[#2F4550] md:text-4xl">{d.title}</h2>

          {d.subtitle && (
            <p className="mx-auto mb-8 max-w-2xl text-lg text-[#2F4550]/80">{d.subtitle}</p>
          )}

          <a
            href={d.buttonHref ?? "#"}
            className="inline-flex items-center gap-2 rounded-full bg-[#E07A5F] px-7 py-3 font-semibold text-white transition hover:bg-[#E07A5F]/90"
          >
            {d.buttonLabel}
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
        </div>
      </div>
    </section>
  );
}
