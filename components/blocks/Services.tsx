import type { BlockProps } from "@/lib/blocks/schema";

export default function Services({ data }: { data: BlockProps["services"] }) {
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

        <ul className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, index) => (
            <li
              key={index}
              className="flex flex-col overflow-hidden rounded-[var(--radius)]"
              style={{ backgroundColor: "var(--color-accent)" }}
            >
              {item.imageUrl && (
                <img
                  src={item.imageUrl}
                  alt=""
                  loading="lazy"
                  className="h-48 w-full object-cover"
                />
              )}

              <div className="flex flex-1 flex-col gap-3 p-6">
                <h3
                  className="text-xl font-semibold"
                  style={{ fontFamily: "var(--font-heading)", color: "var(--color-foreground)" }}
                >
                  {item.name}
                </h3>

                {item.description && (
                  <p
                    className="flex-1 text-base leading-relaxed"
                    style={{ color: "var(--color-muted-foreground)" }}
                  >
                    {item.description}
                  </p>
                )}

                {item.price && (
                  <p
                    className="mt-auto text-lg font-semibold"
                    style={{ color: "var(--color-primary)" }}
                  >
                    {item.price}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
