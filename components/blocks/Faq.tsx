import type { BlockProps } from "@/lib/blocks/schema";

export default function Faq({ data }: { data: BlockProps["faq"] }) {
  const { title, items } = data;

  return (
    <section
      style={{
        backgroundColor: "var(--color-background)",
        color: "var(--color-foreground)",
      }}
    >
      <div className="mx-auto max-w-3xl px-4 py-16">
        {title && (
          <h2
            className="mb-10 text-3xl font-bold md:text-4xl"
            style={{ fontFamily: "var(--font-heading)", color: "var(--color-foreground)" }}
          >
            {title}
          </h2>
        )}

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
                    style={{ color: "var(--color-muted)" }}
                    aria-hidden="true"
                  >
                    +
                  </span>
                </summary>

                <p
                  className="pb-6 text-base leading-relaxed"
                  style={{ color: "var(--color-muted)", fontFamily: "var(--font-body)" }}
                >
                  {item.answer}
                </p>
              </details>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
