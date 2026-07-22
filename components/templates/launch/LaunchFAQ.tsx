import type { BlockProps } from "@/lib/blocks/schema";

/*
 * FAQ — question / answer list. Built on native <details>/<summary> so answers
 * are in the DOM and expandable WITHOUT JS (a `+`→`×` brand chevron rotates via
 * CSS on [open]). First item opens by default.
 *
 * Default: a single stacked accordion.
 * `grid` variant: two columns of open-styled cards for shorter Q/As.
 */
function Chevron() {
  return (
    <svg className="launch-faq-chevron h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
    </svg>
  );
}

function Header({ title }: { title?: string }) {
  return (
    <h2 className="launch-appear mx-auto mb-12 max-w-2xl text-balance text-center text-3xl font-bold sm:text-5xl">
      {title ?? "Питання та відповіді"}
    </h2>
  );
}

export default function LaunchFAQ({ data }: { data: unknown }) {
  const d = data as BlockProps["faq"];

  return (
    <section className="relative px-4 py-20 sm:px-6 md:py-28">
      <div className="mx-auto max-w-3xl">
        <Header title={d.title} />
        <div className="launch-glass rounded-2xl px-5 sm:px-8">
          {d.items.map((item, i) => (
            <details key={i} className="launch-faq-item" open={i === 0}>
              <summary>
                {item.question}
                <Chevron />
              </summary>
              <p className="pb-5 pr-6 text-[15px] leading-relaxed text-[var(--launch-muted)]">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LaunchFAQGrid({ data }: { data: unknown }) {
  const d = data as BlockProps["faq"];

  return (
    <section className="relative px-4 py-20 sm:px-6 md:py-28">
      <div className="mx-auto max-w-5xl">
        <Header title={d.title} />
        <div className="grid gap-4 md:grid-cols-2">
          {d.items.map((item, i) => (
            <details key={i} className="launch-faq-item launch-faq-card launch-glass rounded-2xl px-6" open={i < 2}>
              <summary>
                {item.question}
                <Chevron />
              </summary>
              <p className="pb-5 text-[15px] leading-relaxed text-[var(--launch-muted)]">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
