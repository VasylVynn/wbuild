import type { BlockProps } from "@/lib/blocks/schema";
import { Reveal } from "@/components/templates/shared/reveal";
import { ArrowIcon } from "./icons";

/*
 * CTA — a soft rose call-to-action band (usually links to #lead_form): a
 * rounded-display title on the branding fill, an optional subtitle and a
 * contained light button. Server component with a Reveal island.
 */
type CtaData = BlockProps["cta"];

export default function BelezaCTA({ data }: { data: unknown }) {
  const d = data as CtaData;

  return (
    <section className="beleza-section">
      <div className="beleza-container">
        <Reveal>
          <div
            className="relative overflow-hidden rounded-3xl px-6 py-14 text-center md:px-12 md:py-20"
            style={{ background: "var(--beleza-branding)", color: "var(--beleza-branding-fg)" }}
          >
            <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
            <div className="absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
            <div className="relative mx-auto max-w-2xl">
              <h2 className="text-3xl font-bold leading-tight md:text-4xl">{d.title}</h2>
              {d.subtitle && <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-white/85 md:text-lg">{d.subtitle}</p>}
              <a
                href={d.buttonHref ?? "#lead_form"}
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3 text-sm font-bold text-[color:var(--beleza-branding)] transition-transform hover:-translate-y-0.5"
              >
                {d.buttonLabel}
                <ArrowIcon className="h-4 w-4" />
              </a>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
