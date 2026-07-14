import type { BlockProps } from "@/lib/blocks/schema";

/*
 * About — nextly's clean SectionTitle pattern (indigo eyebrow, bold heading,
 * gray-500 lead) applied to the `richText` block. `d.body` is split on blank
 * lines into paragraphs; a paragraph whose every line starts with "- "
 * renders as a bulleted list instead of prose, mirroring AiSaasAbout's
 * richText convention.
 */
export default function NextlyAbout({ data }: { data: unknown }) {
  const d = data as BlockProps["richText"];
  const align = d.align ?? "left";
  const alignClass = align === "center" ? "mx-auto items-center text-center" : "text-left";

  const blocks = d.body
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  return (
    <section className="w-full px-4 py-16">
      <div className={`mx-auto flex max-w-3xl flex-col ${alignClass}`}>
        <div className="text-sm font-bold tracking-wider text-indigo-600 uppercase">About us</div>

        {d.title && (
          <h2 className="mt-3 text-3xl leading-snug font-bold tracking-tight text-gray-800 lg:text-4xl lg:leading-tight dark:text-white">
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
                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-indigo-500" />
                    <span className="text-gray-600 dark:text-gray-400">{l.slice(2).trim()}</span>
                  </li>
                ))}
              </ul>
            );
          }

          return (
            <p key={i} className="mt-4 text-lg leading-normal text-gray-500 xl:text-xl dark:text-gray-300">
              {block}
            </p>
          );
        })}
      </div>
    </section>
  );
}
