import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Marquee — a scrolling strip of short real keywords (directions / values /
 * offers), reworking the source's logos-strip into a moving band of pills with
 * brand dot separators. Pure-CSS animation (pauses on hover, stops under
 * prefers-reduced-motion); the items are duplicated once for a seamless loop
 * and the copy is always in the DOM (visible without JS). At least 3 items
 * (schema min).
 */
export default function LaunchMarquee({ data }: { data: unknown }) {
  const d = data as BlockProps["marquee"];
  const items = d.items;

  return (
    <section className="relative border-y border-[var(--launch-border)] py-8">
      {d.title && <span className="sr-only">{d.title}</span>}
      <div className="launch-marquee">
        <div className="launch-marquee-track">
          {[0, 1].map((copy) => (
            <ul key={copy} className="flex shrink-0 items-center gap-6 pr-6" aria-hidden={copy === 1}>
              {items.map((item, i) => (
                <li key={i} className="flex items-center gap-6">
                  <span className="whitespace-nowrap text-lg font-semibold text-[var(--launch-fg)] sm:text-xl">
                    {item}
                  </span>
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--launch-brand)]" aria-hidden="true" />
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </section>
  );
}
