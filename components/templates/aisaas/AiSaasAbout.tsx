import type { BlockProps } from "@/lib/blocks/schema";

/*
 * About — friendly intro built for the `richText` block (source has no
 * standalone about section). Coral eyebrow + bold heading over the AI-SaaS
 * pastel palette. `d.body` is split on blank lines into paragraphs; a
 * paragraph whose every line starts with "- " renders as a soft bulleted
 * list (pastel dot marker) instead of prose, mirroring the richText
 * convention used across other templates.
 */
export default function AiSaasAbout({ data }: { data: unknown }) {
  const d = data as BlockProps["richText"];
  const align = d.align ?? "left";
  const alignClass = align === "center" ? "mx-auto text-center" : "text-left";

  const blocks = d.body
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  return (
    <section className="py-16">
      <div className="mx-auto max-w-6xl px-4">
        <div className={`max-w-3xl ${alignClass}`}>
          <span className="mb-3 inline-block text-sm font-semibold uppercase tracking-wide text-[#E07A5F]">
            About us
          </span>

          {d.title && (
            <h2 className="mb-6 text-3xl font-bold text-[#2F4550] md:text-4xl">{d.title}</h2>
          )}

          {blocks.map((block, i) => {
            const lines = block.split("\n").map((l) => l.trim());
            const isList = lines.every((l) => l.startsWith("- "));

            if (isList) {
              return (
                <ul key={i} className={`mt-4 space-y-2.5 text-left ${align === "center" ? "inline-block" : ""}`}>
                  {lines.map((l, j) => (
                    <li key={j} className="flex items-start gap-2.5">
                      <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#FDE1D3]" />
                      <span className="text-[#2F4550]/80">{l.slice(2).trim()}</span>
                    </li>
                  ))}
                </ul>
              );
            }

            return (
              <p key={i} className="mt-4 leading-relaxed text-[#2F4550]/80">
                {block}
              </p>
            );
          })}
        </div>
      </div>
    </section>
  );
}
