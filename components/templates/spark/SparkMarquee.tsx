import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Marquee — a horizontally scrolling strip of short keywords (directions,
 * specialisations, values) in the mono accent, dot-separated. The track is
 * duplicated for a seamless loop; the animation is scoped CSS (spark-marquee),
 * pauses under prefers-reduced-motion. Content stays fully in the DOM without JS.
 */
export default function SparkMarquee({ data }: { data: unknown }) {
  const d = data as BlockProps["marquee"];
  const items = d.items;

  return (
    <section className="border-y border-[var(--spark-border)] bg-[var(--spark-muted)] py-5" aria-label={d.title ?? "Ключові напрями"}>
      <div className="relative overflow-hidden">
        <div className="spark-marquee-track">
          {[0, 1].map((dup) => (
            <div key={dup} className="flex shrink-0 items-center" aria-hidden={dup === 1}>
              {items.map((item, i) => (
                <span key={i} className="flex items-center">
                  <span className="spark-mono px-6 text-sm uppercase tracking-wide text-[var(--spark-fg)]">{item}</span>
                  <span className="text-[var(--spark-muted-fg)]" aria-hidden="true">
                    •
                  </span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
