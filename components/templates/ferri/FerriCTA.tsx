import type { BlockProps } from "@/lib/blocks/schema";
import { Reveal } from "./Reveal";

/*
 * CTA — verbatim port of the source's "CTA FINAL" band: a centred serif
 * heading, description, and a single gold-filled button, fading up on
 * scroll via Reveal. The source's location line is product-specific copy
 * with no matching schema field, so it's dropped.
 */
export default function FerriCTA({ data }: { data: unknown }) {
  const d = data as BlockProps["cta"];

  return (
    <section className="border-t border-gold-500/8 py-14 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="font-[family-name:var(--font-cormorant)] text-2xl font-normal text-cream-100 sm:text-3xl md:text-4xl">
            {d.title}
          </h2>
          {d.subtitle && (
            <p className="mt-6 text-base leading-relaxed text-txt-muted">{d.subtitle}</p>
          )}
          <div className="mt-8 flex flex-wrap justify-center gap-4 sm:mt-10">
            <a
              href={d.buttonHref ?? "#"}
              className="group inline-flex items-center gap-2 bg-gold-500 px-6 py-3 text-[13px] font-medium uppercase tracking-[2px] text-navy-950 transition-all duration-300 hover:bg-gold-400 sm:px-8 sm:py-3.5"
            >
              {d.buttonLabel}
              <svg
                className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
