import type { BlockProps } from "@/lib/blocks/schema";

/*
 * CTA — a centred call-to-action band (usually links to #lead_form) over the
 * signature glow, inside a glass panel. Plain server component.
 */
export default function LaunchCTA({ data }: { data: unknown }) {
  const d = data as BlockProps["cta"];

  return (
    <section className="relative px-4 py-20 sm:px-6 md:py-24">
      <div className="mx-auto max-w-5xl">
        <div className="launch-glass relative overflow-hidden rounded-3xl px-6 py-16 text-center sm:px-12">
          <div className="launch-glow launch-glow--center" aria-hidden="true" />
          <div className="relative z-10 mx-auto flex max-w-2xl flex-col items-center gap-5">
            <h2 className="text-balance text-3xl font-bold sm:text-5xl">{d.title}</h2>
            {d.subtitle && <p className="text-balance text-[var(--launch-muted)] sm:text-lg">{d.subtitle}</p>}
            <a href={d.buttonHref ?? "#lead_form"} className="launch-btn launch-btn--primary mt-2">
              {d.buttonLabel}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/*
 * Variant "split" — the same glass CTA panel over the glow, but copy-left /
 * button-right (stacked on mobile) instead of centred.
 */
export function LaunchCTASplit({ data }: { data: unknown }) {
  const d = data as BlockProps["cta"];

  return (
    <section className="relative px-4 py-20 sm:px-6 md:py-24">
      <div className="mx-auto max-w-5xl">
        <div className="launch-glass relative overflow-hidden rounded-3xl px-6 py-12 sm:px-12">
          <div className="launch-glow launch-glow--center" aria-hidden="true" />
          <div className="relative z-10 flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl">
              <h2 className="text-balance text-2xl font-bold sm:text-4xl">{d.title}</h2>
              {d.subtitle && <p className="mt-3 text-balance text-[var(--launch-muted)] sm:text-lg">{d.subtitle}</p>}
            </div>
            <a href={d.buttonHref ?? "#lead_form"} className="launch-btn launch-btn--primary shrink-0">
              {d.buttonLabel}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
