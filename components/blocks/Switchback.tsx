import type { BlockProps } from "@/lib/blocks/schema";

/**
 * Switchback — SKINS (layout variants of the SAME content, brief §3):
 *  - ""        alternating image/text rows (zig-zag) — the original layout.
 *  - "framed"  each row wrapped in a bordered, rounded, softly-shadowed panel
 *              with inner padding; image rounded inside the frame.
 * Both skins render an optional inline primary CTA under the body when an item
 * carries `buttonLabel` (href = buttonHref ?? "#lead"). Only layout changes
 * between skins; all styling uses tenant CSS vars only.
 */

type SwitchbackData = BlockProps["switchback"];
type SwitchbackItem = SwitchbackData["items"][number];

function SectionTitle({ title }: { title: string }) {
  return (
    <h2
      className="mb-12 text-3xl font-bold md:text-4xl"
      style={{ fontFamily: "var(--font-heading)", color: "var(--color-foreground)" }}
    >
      {title}
    </h2>
  );
}

// Shared text column (heading + body + optional inline CTA). Rendered inside a
// `space-y-4` container by every skin, so the CTA inherits the same rhythm and
// the markup stays pixel-identical to the original when no CTA prop is present.
function ItemText({ item }: { item: SwitchbackItem }) {
  return (
    <>
      <h3
        className="text-2xl font-bold md:text-3xl"
        style={{ fontFamily: "var(--font-heading)", color: "var(--color-foreground)" }}
      >
        {item.heading}
      </h3>
      <p
        className="text-lg leading-relaxed"
        style={{ color: "var(--color-muted-foreground)", fontFamily: "var(--font-body)" }}
      >
        {item.body}
      </p>
      {item.buttonLabel && (
        <a
          href={item.buttonHref ?? "#lead"}
          className="inline-block rounded-[var(--radius)] px-6 py-3 font-semibold"
          style={{
            backgroundColor: "var(--color-primary)",
            color: "var(--color-primary-foreground)",
          }}
        >
          {item.buttonLabel}
        </a>
      )}
    </>
  );
}

// "" — the original zig-zag layout, extracted unchanged (CTA only appears when
// the new buttonLabel prop is present, so props-absent output is identical).
function SwitchbackDefault({ data }: { data: SwitchbackData }) {
  const { title, items } = data;
  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      {title && <SectionTitle title={title} />}

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
                  alt={item.heading}
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
                <ItemText item={item} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// "framed" — every row lives in its own bordered, softly-shadowed panel.
function SwitchbackFramed({ data }: { data: SwitchbackData }) {
  const { title, items } = data;
  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      {title && <SectionTitle title={title} />}

      <div className="flex flex-col gap-8">
        {items.map((item, index) => {
          const imageRight = index % 2 !== 0;
          return (
            <div
              key={index}
              className={`flex flex-col gap-8 rounded-2xl p-6 md:items-center md:p-8 ${imageRight ? "md:flex-row-reverse" : "md:flex-row"}`}
              style={{
                border:
                  "1px solid color-mix(in srgb, var(--color-foreground) 12%, transparent)",
                boxShadow:
                  "0 10px 30px -12px color-mix(in srgb, var(--color-foreground) 25%, transparent)",
              }}
            >
              {/* Image */}
              <div className="flex-1">
                <img
                  src={item.imageUrl}
                  alt={item.heading}
                  loading="lazy"
                  className="w-full rounded-lg object-cover"
                  style={{ maxHeight: "420px" }}
                />
              </div>

              {/* Text */}
              <div className="flex-1 space-y-4">
                <ItemText item={item} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Switchback({
  data,
  skin,
}: {
  data: SwitchbackData;
  skin?: string;
}) {
  return (
    <section
      style={{
        backgroundColor: "var(--color-background)",
        color: "var(--color-foreground)",
      }}
    >
      {skin === "framed" ? (
        <SwitchbackFramed data={data} />
      ) : (
        <SwitchbackDefault data={data} />
      )}
    </section>
  );
}
