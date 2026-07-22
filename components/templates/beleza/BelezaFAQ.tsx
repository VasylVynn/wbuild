import type { BlockProps } from "@/lib/blocks/schema";
import { Reveal } from "@/components/templates/shared/reveal";

/*
 * FAQ — native <details>/<summary> accordion (works fully without JS — H5),
 * first item open by default, with a rose chevron that rotates when open. Two
 * layouts:
 *
 * Default:  a clean divided list.
 * `boxed`:  each Q/A in its own soft card.
 */
type FaqData = BlockProps["faq"];

function Chevron() {
  return (
    <svg className="h-5 w-5 shrink-0 text-[color:var(--beleza-branding)] transition-transform duration-300 group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
    </svg>
  );
}

function Header({ title }: { title?: string }) {
  if (!title) return null;
  return (
    <Reveal className="mb-10 md:mb-14">
      <h2 className="beleza-kicker">
        <strong>{title}</strong> Усе, що варто знати перед візитом.
      </h2>
    </Reveal>
  );
}

export default function BelezaFAQ({ data }: { data: unknown }) {
  const d = data as FaqData;

  return (
    <section id="faq" className="beleza-section">
      <div className="beleza-container">
        <Header title={d.title} />
        <div className="mx-auto max-w-3xl border-t" style={{ borderColor: "var(--beleza-border-subtle)" }}>
          {d.items.map((item, i) => (
            <details key={i} className="group border-b" style={{ borderColor: "var(--beleza-border-subtle)" }} open={i === 0}>
              <summary className="beleza-ink flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-[15px] font-semibold md:text-base">
                {item.question}
                <Chevron />
              </summary>
              <p className="beleza-muted pb-5 pr-8 text-sm leading-relaxed md:text-[15px]">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function BelezaFAQBoxed({ data }: { data: unknown }) {
  const d = data as FaqData;

  return (
    <section id="faq" className="beleza-section beleza-tint">
      <div className="beleza-container">
        <Header title={d.title} />
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-4 md:grid-cols-2">
          {d.items.map((item, i) => (
            <details key={i} className="beleza-card group" open={i === 0}>
              <summary className="beleza-ink flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-semibold">
                {item.question}
                <Chevron />
              </summary>
              <p className="beleza-muted mt-3 text-sm leading-relaxed">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
