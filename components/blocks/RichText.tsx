import type { BlockProps } from "@/lib/blocks/schema";

export default function RichText({ data }: { data: BlockProps["richText"] }) {
  const { title, body, align = "center" } = data;

  const paragraphs = body.split("\n\n").filter(Boolean);
  const isCenter = align === "center";

  return (
    <section
      style={{
        backgroundColor: "var(--color-background)",
        color: "var(--color-foreground)",
      }}
    >
      <div className={`mx-auto max-w-3xl px-4 py-16 ${isCenter ? "text-center" : "text-left"}`}>
        {title && (
          <h2
            className="mb-8 text-3xl font-bold md:text-4xl"
            style={{ fontFamily: "var(--font-heading)", color: "var(--color-foreground)" }}
          >
            {title}
          </h2>
        )}

        <div className="space-y-6">
          {paragraphs.map((paragraph, index) => (
            <p
              key={index}
              className="text-lg leading-relaxed"
              style={{ color: "var(--color-foreground)", fontFamily: "var(--font-body)" }}
            >
              {paragraph}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}
