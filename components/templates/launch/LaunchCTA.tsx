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
