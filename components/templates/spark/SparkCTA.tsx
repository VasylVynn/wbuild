import type { BlockProps } from "@/lib/blocks/schema";

/*
 * CTA — a centred call-to-action band on the muted surface (the source's
 * cta-banner): medium title, muted subtitle, a solid primary button.
 */
export default function SparkCTA({ data }: { data: unknown }) {
  const d = data as BlockProps["cta"];

  return (
    <section className="bg-[var(--spark-bg)] px-4 py-16 sm:px-6 md:py-24 lg:px-8">
      <div className="mx-auto max-w-4xl rounded-[var(--spark-radius)] border border-[var(--spark-border)] bg-[var(--spark-muted)] px-6 py-14 text-center md:px-12">
        <h2 className="text-3xl text-[var(--spark-fg)] md:text-4xl">{d.title}</h2>
        {d.subtitle && (
          <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-[var(--spark-muted-fg)]">{d.subtitle}</p>
        )}
        <div className="mt-8 flex justify-center">
          <a href={d.buttonHref ?? "#lead_form"} className="spark-btn spark-btn-primary">
            {d.buttonLabel}
          </a>
        </div>
      </div>
    </section>
  );
}
