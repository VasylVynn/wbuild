import type { BlockProps } from "@/lib/blocks/schema";

export default function Gallery({ data }: { data: BlockProps["gallery"] }) {
  const { title, images } = data;

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

        <ul className="columns-2 gap-4 space-y-4 md:columns-3">
          {images.map((image, index) => (
            <li key={index} className="break-inside-avoid">
              <img
                src={image.url}
                alt={image.alt ?? ""}
                loading="lazy"
                className="w-full rounded-[var(--radius)] object-cover"
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
