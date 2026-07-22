import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Timeline — a faithful port of the source's timeline: a single-line rail with
 * mono numbered badges and a hairline card per step (period, title, subtitle,
 * description). Reads the `timeline` block. Only real dates/periods.
 */
export default function SparkTimeline({ data }: { data: unknown }) {
  const d = data as BlockProps["timeline"];

  return (
    <section className="bg-[var(--spark-bg)] px-4 py-16 sm:px-6 md:py-24 lg:px-8">
      <div className="mx-auto max-w-3xl">
        {d.title && (
          <div className="mb-16 text-center">
            <h2 className="text-3xl text-[var(--spark-fg)] md:text-4xl">{d.title}</h2>
          </div>
        )}
        <div className="relative">
          <div className="absolute bottom-6 left-6 top-6 hidden w-px bg-[var(--spark-border)] sm:block" aria-hidden="true" />
          <div className="space-y-2">
            {d.items.map((item, i) => (
              <div key={i} className="group relative flex gap-6 sm:gap-8">
                <div className="relative z-10 flex-shrink-0">
                  <div className="flex h-12 w-12 items-center justify-center rounded-[var(--spark-radius)] border border-[var(--spark-border)] bg-[var(--spark-bg)] transition-colors group-hover:border-[var(--spark-fg)]">
                    <span className="spark-mono text-sm text-[var(--spark-muted-fg)] transition-colors group-hover:text-[var(--spark-fg)]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                </div>
                <div className="flex-1 pb-8 pt-1">
                  <div className="spark-card p-6">
                    {item.period && (
                      <p className="spark-mono mb-2 text-xs uppercase tracking-wide text-[var(--spark-muted-fg)]">
                        {item.period}
                      </p>
                    )}
                    <h3 className="text-base text-[var(--spark-fg)]">{item.title}</h3>
                    {item.subtitle && (
                      <p className="mt-1 text-sm text-[var(--spark-muted-fg)]">{item.subtitle}</p>
                    )}
                    {item.description && (
                      <p className="mt-2 text-sm leading-relaxed text-[var(--spark-muted-fg)]">{item.description}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
