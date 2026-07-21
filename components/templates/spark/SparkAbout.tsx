import type { BlockProps } from "@/lib/blocks/schema";

/*
 * About — the source's centred content-block: an optional mono eyebrow-less
 * heading over relaxed prose. Paragraphs split on blank lines; lines starting
 * with "- " render as a checked list. Reads the `richText` block.
 */
export default function SparkAbout({ data }: { data: unknown }) {
  const d = data as BlockProps["richText"];
  const align = d.align === "center" ? "center" : "left";
  const blocks = d.body.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);

  return (
    <section className="bg-[var(--spark-bg)] px-4 py-16 sm:px-6 md:py-24 lg:px-8">
      <div className={`mx-auto max-w-3xl ${align === "center" ? "text-center" : ""}`}>
        {d.title && <h2 className="mb-6 text-3xl text-[var(--spark-fg)] md:text-4xl">{d.title}</h2>}
        <div className="space-y-4">
          {blocks.map((para, i) => {
            const lines = para.split("\n");
            const isList = lines.every((l) => l.trim().startsWith("- "));
            if (isList) {
              return (
                <ul key={i} className={`space-y-2 ${align === "center" ? "inline-block text-left" : ""}`}>
                  {lines.map((l, j) => (
                    <li key={j} className="flex gap-2 text-[var(--spark-muted-fg)]">
                      <span className="mt-1 text-[var(--spark-fg)]" aria-hidden="true">
                        —
                      </span>
                      <span className="leading-relaxed">{l.replace(/^-\s+/, "")}</span>
                    </li>
                  ))}
                </ul>
              );
            }
            return (
              <p key={i} className="text-lg leading-relaxed text-[var(--spark-muted-fg)]">
                {para}
              </p>
            );
          })}
        </div>
      </div>
    </section>
  );
}
