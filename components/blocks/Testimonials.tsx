import type { BlockProps } from "@/lib/blocks/schema";

export default function Testimonials({ data }: { data: BlockProps["testimonials"] }) {
  const { title, items } = data;

  return (
    <section
      style={{
        backgroundColor: "var(--color-background)",
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

        <ul className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {items.map((item, index) => (
            <li
              key={index}
              className="flex flex-col gap-4 rounded-[var(--radius)] p-8"
              style={{
                backgroundColor: "var(--color-accent)",
                borderLeft: "4px solid var(--color-primary)",
              }}
            >
              <blockquote
                className="text-lg leading-relaxed"
                style={{ color: "var(--color-foreground)" }}
              >
                &ldquo;{item.quote}&rdquo;
              </blockquote>

              <footer className="mt-auto">
                <p
                  className="font-semibold"
                  style={{ color: "var(--color-foreground)" }}
                >
                  {item.author}
                </p>
                {item.role && (
                  <p
                    className="text-sm"
                    style={{ color: "var(--color-muted)" }}
                  >
                    {item.role}
                  </p>
                )}
              </footer>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
