import type { BlockProps } from "@/lib/blocks/schema";

/*
 * About — text-focused port of the source About.jsx bio/mission copy. The
 * source pairs the bio with a 2x2 highlights grid; `richText` has no items
 * field, so this keeps only the text column: amber eyebrow, serif-accented
 * title, a teal divider, then flowing body copy.
 *
 * Body parsing: `d.body` splits on blank lines into paragraphs. A paragraph
 * whose every line starts with "- " renders as a refined list (teal dot
 * markers) instead of prose, mirroring the richText handling used elsewhere.
 */
export default function PortfolioAbout({ data }: { data: unknown }) {
  const d = data as BlockProps["richText"];
  const align = d.align ?? "left";
  const alignClass = align === "center" ? "text-center" : "text-left";

  const paragraphs = d.body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <section className="py-16 sm:py-24">
      <div className="container mx-auto px-6">
        <div className={`animate-fade-in mx-auto max-w-3xl ${alignClass}`}>
          <span className="text-highlight text-sm font-medium tracking-wider uppercase">
            Про мене
          </span>

          {d.title && (
            <h2 className="font-serif mt-3 text-3xl text-foreground sm:text-4xl md:text-5xl">
              {d.title}
            </h2>
          )}

          <div className={`mt-6 h-px w-16 bg-primary ${align === "center" ? "mx-auto" : ""}`} />

          {paragraphs.map((block, i) => {
            const lines = block.split("\n").map((l) => l.trim());
            const isList = lines.every((l) => l.startsWith("- "));

            if (isList) {
              return (
                <ul key={i} className="mt-6 space-y-3 text-left">
                  {lines.map((l, j) => (
                    <li key={j} className="flex items-start gap-3">
                      <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <span className="text-muted-foreground leading-relaxed">
                        {l.slice(2).trim()}
                      </span>
                    </li>
                  ))}
                </ul>
              );
            }

            return (
              <p key={i} className="text-muted-foreground mt-6 leading-relaxed">
                {block}
              </p>
            );
          })}
        </div>
      </div>
    </section>
  );
}
