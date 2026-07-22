import type { BlockProps } from "@/lib/blocks/schema";

/*
 * FAQ — the source's clean Q/A. DEFAULT: a hairline-divided list with every
 * answer visible (fully readable, zero JS). Variant "accordion": native
 * <details>/<summary> disclosures with a rotating chevron — expands WITHOUT JS
 * (H5), first item open by default. Both read the `faq` block.
 */

export default function SparkFAQ({ data }: { data: unknown }) {
  const d = data as BlockProps["faq"];

  return (
    <section id="faq" className="bg-[var(--spark-bg)] px-4 py-16 sm:px-6 md:py-24 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-12 text-center">
          <p className="spark-eyebrow mb-3">FAQ</p>
          {d.title && <h2 className="text-3xl text-[var(--spark-fg)] md:text-4xl">{d.title}</h2>}
        </div>
        <dl className="divide-y divide-[var(--spark-border)] border-y border-[var(--spark-border)]">
          {d.items.map((item, i) => (
            <div key={i} className="py-6">
              <dt className="text-base font-medium text-[var(--spark-fg)]">{item.question}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-[var(--spark-muted-fg)]">{item.answer}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/*
 * Variant "accordion" — native <details> disclosures (work without JS).
 */
export function SparkFAQAccordion({ data }: { data: unknown }) {
  const d = data as BlockProps["faq"];

  return (
    <section id="faq" className="bg-[var(--spark-bg)] px-4 py-16 sm:px-6 md:py-24 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-12 text-center">
          <p className="spark-eyebrow mb-3">FAQ</p>
          {d.title && <h2 className="text-3xl text-[var(--spark-fg)] md:text-4xl">{d.title}</h2>}
        </div>
        <div className="space-y-3">
          {d.items.map((item, i) => (
            <details key={i} open={i === 0} className="spark-card px-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-base font-medium text-[var(--spark-fg)] [&::-webkit-details-marker]:hidden">
                {item.question}
                <svg
                  className="spark-chevron h-4 w-4 shrink-0 text-[var(--spark-muted-fg)] transition-transform duration-200"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                </svg>
              </summary>
              <p className="pb-5 text-sm leading-relaxed text-[var(--spark-muted-fg)]">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
