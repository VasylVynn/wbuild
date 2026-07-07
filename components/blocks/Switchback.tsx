import type { BlockProps } from "@/lib/blocks/schema";

export default function Switchback({ data }: { data: BlockProps["switchback"] }) {
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

        <div className="flex flex-col gap-16">
          {items.map((item, index) => {
            const imageRight = index % 2 !== 0;
            return (
              <div
                key={index}
                className={`flex flex-col gap-8 md:items-center ${imageRight ? "md:flex-row-reverse" : "md:flex-row"}`}
              >
                {/* Image */}
                <div className="flex-1">
                  <img
                    src={item.imageUrl}
                    alt=""
                    loading="lazy"
                    className="w-full object-cover"
                    style={{
                      borderRadius: "var(--radius)",
                      maxHeight: "420px",
                    }}
                  />
                </div>

                {/* Text */}
                <div className="flex-1 space-y-4">
                  <h3
                    className="text-2xl font-bold md:text-3xl"
                    style={{ fontFamily: "var(--font-heading)", color: "var(--color-foreground)" }}
                  >
                    {item.heading}
                  </h3>
                  <p
                    className="text-lg leading-relaxed"
                    style={{ color: "var(--color-muted)", fontFamily: "var(--font-body)" }}
                  >
                    {item.body}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
