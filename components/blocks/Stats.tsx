import type { BlockProps } from "@/lib/blocks/schema";

export default function Stats({ data }: { data: BlockProps["stats"] }) {
  const { title, items } = data;

  return (
    <section
      style={{
        backgroundColor: "var(--color-accent)",
        color: "var(--color-foreground)",
      }}
    >
      <div className="mx-auto max-w-5xl px-4 py-16">
        {title && (
          <h2
            className="mb-12 text-3xl font-bold md:text-4xl"
            style={{ fontFamily: "var(--font-heading)", color: "var(--color-foreground)" }}
          >
            {title}
          </h2>
        )}

        <ul className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item, index) => (
            <li key={index} className="flex flex-col items-center gap-2 text-center">
              <span
                className="text-4xl font-bold leading-tight md:text-5xl"
                style={{
                  fontFamily: "var(--font-heading)",
                  color: "var(--color-primary)",
                }}
              >
                {item.value}
              </span>
              <span
                className="text-base leading-snug"
                style={{ color: "var(--color-muted-foreground)" }}
              >
                {item.label}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
