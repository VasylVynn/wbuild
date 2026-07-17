import type { BlockProps } from "@/lib/blocks/schema";

/*
 * About — warm centered/left intro for the `richText` block. Terracotta
 * eyebrow + serif heading over taupe body copy on the cream canvas. Mirrors
 * AiSaasAbout: `d.body` is split on blank lines into paragraphs, and a
 * paragraph whose every line starts with "- " renders as a soft bulleted
 * list (terracotta dot marker) instead of prose.
 */
export default function RestaurantAbout({ data }: { data: unknown }) {
  const d = data as BlockProps["richText"];
  const align = d.align ?? "left";
  const alignClass = align === "center" ? "mx-auto text-center" : "text-left";

  const blocks = d.body
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  return (
    <section className="bg-[#F3EADD] py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className={`max-w-3xl ${alignClass}`}>
          <span className="mb-3 inline-block text-sm font-semibold uppercase tracking-wide text-[#C0562F]">
            About us
          </span>

          {d.title && <h2 className="mb-6 text-3xl font-bold text-[#2A2018] md:text-4xl">{d.title}</h2>}

          {blocks.map((block, i) => {
            const lines = block.split("\n").map((l) => l.trim());
            const isList = lines.every((l) => l.startsWith("- "));

            if (isList) {
              return (
                <ul key={i} className={`mt-4 space-y-2.5 text-left ${align === "center" ? "inline-block" : ""}`}>
                  {lines.map((l, j) => (
                    <li key={j} className="flex items-start gap-2.5">
                      <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#C0562F]" />
                      <span className="text-[#6F6257]">{l.slice(2).trim()}</span>
                    </li>
                  ))}
                </ul>
              );
            }

            return (
              <p key={i} className="mt-4 leading-relaxed text-[#6F6257]">
                {block}
              </p>
            );
          })}
        </div>
      </div>
    </section>
  );
}
