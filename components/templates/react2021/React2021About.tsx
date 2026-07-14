import type { BlockProps } from "@/lib/blocks/schema";

/*
 * About — friendly intro built for the `richText` block (the source
 * react-2021 template has no standalone about section). Mirrors
 * AiSaasAbout's structure (coral eyebrow, optional title, `d.body` split on
 * blank lines into paragraphs, with a paragraph whose every line starts
 * "- " rendered as a soft bulleted list) but in react-2021's clean palette:
 * dark-ink heading, gray-500/600 body, coral accents.
 */
export default function React2021About({ data }: { data: unknown }) {
  const d = data as BlockProps["richText"];
  const align = d.align ?? "left";
  const alignClass = align === "center" ? "mx-auto text-center" : "text-left";

  const blocks = d.body
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  return (
    <section className="bg-gray-50 py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className={`max-w-3xl ${alignClass}`}>
          <span className="mb-3 inline-block text-sm font-semibold uppercase tracking-wide text-[#ec4755]">
            About us
          </span>

          {d.title && (
            <h2 className="mb-6 text-3xl font-extrabold tracking-tight text-[#1a2e35] md:text-4xl">
              {d.title}
            </h2>
          )}

          {blocks.map((block, i) => {
            const lines = block.split("\n").map((l) => l.trim());
            const isList = lines.every((l) => l.startsWith("- "));

            if (isList) {
              return (
                <ul key={i} className={`mt-4 space-y-2.5 text-left ${align === "center" ? "inline-block" : ""}`}>
                  {lines.map((l, j) => (
                    <li key={j} className="flex items-start gap-2.5">
                      <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#ec4755]" />
                      <span className="text-gray-600">{l.slice(2).trim()}</span>
                    </li>
                  ))}
                </ul>
              );
            }

            return (
              <p key={i} className="mt-4 leading-relaxed text-gray-600">
                {block}
              </p>
            );
          })}
        </div>
      </div>
    </section>
  );
}
