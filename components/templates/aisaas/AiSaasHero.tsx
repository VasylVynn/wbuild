import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Hero — verbatim port of the source AI-SaaS hero: rounded pastel-lavender
 * panel with a dot-grid backdrop and two pulsing purple/blue gradient blobs.
 * The source's hardcoded badge/title/description/CTA copy is parameterised
 * (eyebrow, title + optional coral titleAccent, subtitle, two pill CTAs);
 * the "New" pill and the bottom trust chip are kept verbatim as static
 * decoration since the schema has no matching fields. lucide icons are
 * swapped for tiny inline SVGs (arrow, globe) per the no-lucide rule.
 */
export default function AiSaasHero({ data }: { data: unknown }) {
  const d = data as BlockProps["hero"];

  return (
    <section className="relative w-full overflow-hidden rounded-3xl bg-[#F1F0FB] px-4 py-16">
      {/* Dot pattern */}
      <div className="absolute inset-0 h-full w-full bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-size-[24px_24px]" />

      {/* Animated gradient blobs */}
      <div className="absolute -left-[10%] -top-[10%] h-[500px] w-[500px] animate-pulse rounded-full bg-purple-400/30 blur-[100px] filter" />
      <div className="absolute -bottom-[10%] -right-[10%] h-[500px] w-[500px] animate-pulse rounded-full bg-blue-400/30 blur-[100px] filter" />

      <div className="relative mx-auto max-w-4xl text-center">
        <div className="animate-pulse-light mb-3 inline-flex items-center rounded-full bg-white/80 px-4 py-1.5 text-sm font-medium text-[#E07A5F]">
          <span className="mr-2 rounded-full bg-[#E07A5F] px-2 py-0.5 text-xs text-white">New</span>
          {d.eyebrow}
        </div>

        <h1 className="mb-4 text-4xl font-bold leading-snug text-[#2F4550] md:text-5xl md:leading-snug lg:text-6xl lg:leading-snug">
          {d.title}
          {d.titleAccent && <span className="text-[#E07A5F]"> {d.titleAccent}</span>}
        </h1>

        {d.subtitle && (
          <p className="mx-auto mb-10 max-w-3xl text-lg text-[#2F4550]/80 md:text-xl">{d.subtitle}</p>
        )}

        <div className="mb-8 flex flex-col justify-center gap-4 px-5 sm:flex-row">
          {d.ctaLabel && (
            <a
              href={d.ctaHref ?? "#"}
              className="flex items-center justify-center rounded-full bg-[#FDE1D3] px-6 py-2 font-semibold text-[#2F4550] hover:bg-[#FDE1D3]/90"
            >
              <svg className="mr-2 h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M7 7h10v10" />
              </svg>
              {d.ctaLabel}
            </a>
          )}

          {d.secondaryCtaLabel && (
            <a
              href={d.secondaryCtaHref ?? "#"}
              className="flex items-center justify-center rounded-full bg-[#D3E4FD] px-6 py-2 font-semibold text-[#2F4550] hover:bg-[#D3E4FD]/90"
            >
              <svg className="mr-2 h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2 12h20M12 2c2.5 2.7 4 6.2 4 10s-1.5 7.3-4 10c-2.5-2.7-4-6.2-4-10s1.5-7.3 4-10Z" />
              </svg>
              {d.secondaryCtaLabel}
            </a>
          )}
        </div>

        {d.imageUrl && (
          <div className="mb-8 overflow-hidden rounded-3xl shadow-xl">
            <img src={d.imageUrl} alt={d.title} className="h-auto w-full object-cover" />
          </div>
        )}

        <div className="mt-16 flex items-center justify-center">
          <div className="flex items-center space-x-2 rounded-full bg-white/70 px-4 py-2 backdrop-blur-sm">
            <svg className="h-[18px] w-[18px] shrink-0 text-[#3D8690]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2 12h20M12 2c2.5 2.7 4 6.2 4 10s-1.5 7.3-4 10c-2.5-2.7-4-6.2-4-10s1.5-7.3 4-10Z" />
            </svg>
            <span className="text-sm font-medium text-[#2F4550]">Trusted by teams worldwide</span>
          </div>
        </div>
      </div>
    </section>
  );
}
