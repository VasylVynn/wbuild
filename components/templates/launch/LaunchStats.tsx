import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Stats — a strip of grounded numbers (never invented). Mirrors the source's
 * stats look: big gradient value with a soft brand drop-shadow over a small
 * muted label. Our stat item is { value, label } (value is a free string like
 * "500+"), so no suffix splitting.
 */
export default function LaunchStats({ data }: { data: unknown }) {
  const d = data as BlockProps["stats"];

  return (
    <section className="relative px-4 py-16 sm:px-6 md:py-20">
      <div className="mx-auto max-w-5xl">
        {d.title && (
          <h2 className="launch-appear mb-12 text-center text-2xl font-bold sm:text-4xl">{d.title}</h2>
        )}
        <div className="grid grid-cols-2 gap-10 sm:grid-cols-4">
          {d.items.map((item, i) => (
            <div key={i} className="flex flex-col items-center gap-2 text-center sm:items-start sm:text-left">
              <div
                className="launch-gradient-text text-4xl font-extrabold sm:text-5xl md:text-6xl"
                style={{ filter: "drop-shadow(0 2px 20px color-mix(in oklch, var(--launch-brand-strong) 45%, transparent))" }}
              >
                {item.value}
              </div>
              <div className="text-sm font-medium text-[var(--launch-muted)]">{item.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
