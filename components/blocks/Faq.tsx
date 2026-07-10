import type { BlockProps } from "@/lib/blocks/schema";

/**
 * Faq — SKINS (layout variants of the SAME content, brief §3):
 *  - ""          open Q/A list with a static "+" glyph — the original layout.
 *  - "accordion" native <details name="faq-accordion"> items: the shared `name`
 *                gives single-open exclusivity in modern browsers and degrades
 *                to multi-open elsewhere — zero JS, stays a server component.
 *                The "+" glyph rotates 45° into an "×" when open, and the answer
 *                reveals with a small CSS animation. Interaction is pure CSS.
 */

type FaqData = BlockProps["faq"];

function SectionTitle({ title }: { title: string }) {
  return (
    <h2
      className="mb-10 text-3xl font-bold md:text-4xl"
      style={{ fontFamily: "var(--font-heading)", color: "var(--color-foreground)" }}
    >
      {title}
    </h2>
  );
}

// "" — the original open Q/A list, extracted unchanged.
function FaqDefault({ data }: { data: FaqData }) {
  const { title, items } = data;
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      {title && <SectionTitle title={title} />}

      <ul className="flex flex-col">
        {items.map((item, index) => (
          <li
            key={index}
            style={{
              borderTopWidth: index === 0 ? "1px" : "0",
              borderBottomWidth: "1px",
              borderColor: "var(--color-muted)",
              borderStyle: "solid",
            }}
          >
            <details className="group">
              <summary
                className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-lg font-semibold"
                style={{ color: "var(--color-foreground)" }}
              >
                {item.question}
                {/* Simple +/- indicator — no JS, pure CSS via open attribute */}
                <span
                  className="shrink-0 text-2xl font-light"
                  style={{ color: "var(--color-muted-foreground)" }}
                  aria-hidden="true"
                >
                  +
                </span>
              </summary>

              <p
                className="pb-6 text-base leading-relaxed"
                style={{ color: "var(--color-muted-foreground)", fontFamily: "var(--font-body)" }}
              >
                {item.answer}
              </p>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}

// "accordion" — exclusive single-open <details> with a rotating "+" indicator.
function FaqAccordion({ data }: { data: FaqData }) {
  const { title, items } = data;
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      {/* Scoped, faq-acc-prefixed styles: strips the native marker, rotates the
          glyph on [open], and reveals the answer — all zero-JS CSS. */}
      <style>{`
        .faq-acc-item { border-bottom: 1px solid var(--color-muted); }
        .faq-acc-item:first-child { border-top: 1px solid var(--color-muted); }
        .faq-acc-summary { list-style: none; }
        .faq-acc-summary::-webkit-details-marker { display: none; }
        .faq-acc-icon { transition: transform 0.2s ease; }
        .faq-acc-item[open] .faq-acc-icon { transform: rotate(45deg); }
        .faq-acc-item[open] .faq-acc-answer { animation: faq-acc-reveal 0.2s ease; }
        @keyframes faq-acc-reveal {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {title && <SectionTitle title={title} />}

      <div>
        {items.map((item, index) => (
          <details key={index} name="faq-accordion" className="faq-acc-item">
            <summary
              className="faq-acc-summary flex cursor-pointer items-center justify-between gap-4 py-5 text-lg font-semibold"
              style={{ color: "var(--color-foreground)" }}
            >
              {item.question}
              <span
                className="faq-acc-icon shrink-0 text-2xl font-light"
                style={{ color: "var(--color-muted-foreground)" }}
                aria-hidden="true"
              >
                +
              </span>
            </summary>

            <p
              className="faq-acc-answer pb-6 text-base leading-relaxed"
              style={{ color: "var(--color-muted-foreground)", fontFamily: "var(--font-body)" }}
            >
              {item.answer}
            </p>
          </details>
        ))}
      </div>
    </div>
  );
}

export default function Faq({
  data,
  skin,
}: {
  data: FaqData;
  skin?: string;
}) {
  return (
    <section
      style={{
        backgroundColor: "var(--color-background)",
        color: "var(--color-foreground)",
      }}
    >
      {skin === "accordion" ? <FaqAccordion data={data} /> : <FaqDefault data={data} />}
    </section>
  );
}
