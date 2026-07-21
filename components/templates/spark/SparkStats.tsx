import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Stats — the source's quiet metric row: big medium numbers over small muted
 * labels, centred on a hairline-bordered band. Only real, grounded numbers.
 */
export default function SparkStats({ data }: { data: unknown }) {
  const d = data as BlockProps["stats"];

  return (
    <section className="bg-[var(--spark-bg)] px-4 py-16 sm:px-6 md:py-20 lg:px-8">
      <div className="mx-auto max-w-6xl rounded-[var(--spark-radius)] border border-[var(--spark-border)] bg-[var(--spark-muted)] px-6 py-12">
        {d.title && (
          <h2 className="mb-10 text-center text-2xl text-[var(--spark-fg)] md:text-3xl">{d.title}</h2>
        )}
        <div className="grid grid-cols-2 gap-8 text-center md:grid-cols-4">
          {d.items.map((item, i) => (
            <div key={i}>
              <p className="text-3xl text-[var(--spark-fg)] md:text-4xl">{item.value}</p>
              <p className="mt-2 text-sm text-[var(--spark-muted-fg)]">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
