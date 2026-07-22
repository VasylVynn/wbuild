import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Switchback — alternating "image + text" storytelling rows (zig-zag): the
 * process, the difference, the story. Rows flip side every other item (lg).
 * §4.8: media comes only from props — a missing photo degrades to a decorative
 * glass panel with a glow, never a broken <img>. Plain server component.
 */
type Item = BlockProps["switchback"]["items"][number];

function SwitchbackMedia({ item }: { item: Item }) {
  if (item.imageUrl) {
    return (
      <div className="launch-glass overflow-hidden rounded-2xl p-2" style={{ boxShadow: "var(--launch-shadow)" }}>
        <img src={item.imageUrl} alt={item.heading} className="aspect-[4/3] w-full rounded-xl object-cover" />
      </div>
    );
  }
  return (
    <div className="launch-glass relative aspect-[4/3] overflow-hidden rounded-2xl" style={{ boxShadow: "var(--launch-shadow)" }}>
      <div className="launch-glow launch-glow--center" aria-hidden="true" />
    </div>
  );
}

export default function LaunchSwitchback({ data }: { data: unknown }) {
  const d = data as BlockProps["switchback"];

  return (
    <section className="relative px-4 py-20 sm:px-6 md:py-28">
      <div className="mx-auto max-w-6xl">
        {d.title && (
          <h2 className="launch-appear mx-auto mb-16 max-w-2xl text-balance text-center text-3xl font-bold sm:text-5xl">
            {d.title}
          </h2>
        )}
        <div className="space-y-16 md:space-y-24">
          {d.items.map((item, i) => (
            <div
              key={i}
              className={`flex flex-col gap-8 lg:flex-row lg:items-center lg:gap-16 ${
                i % 2 === 1 ? "lg:flex-row-reverse" : ""
              }`}
            >
              <div className="lg:w-1/2">
                <SwitchbackMedia item={item} />
              </div>
              <div className="lg:w-1/2">
                <h3 className="text-2xl font-bold text-[var(--launch-fg)] md:text-3xl">{item.heading}</h3>
                <p className="mt-4 leading-relaxed text-[var(--launch-muted)]">{item.body}</p>
                {item.buttonLabel && (
                  <a
                    href={item.buttonHref ?? "#lead_form"}
                    className="mt-6 inline-flex items-center gap-2 font-semibold text-[var(--launch-brand)] transition-colors hover:opacity-80"
                  >
                    {item.buttonLabel}
                    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/*
 * Variant "cards" — the same steps as bordered cards in a grid (no zig-zag):
 * each card frames its media (photo or glow panel, §4.8) over heading, body and
 * an optional arrow link. Same glow-and-glass idiom, a denser arrangement.
 */
export function LaunchSwitchbackCards({ data }: { data: unknown }) {
  const d = data as BlockProps["switchback"];

  return (
    <section className="relative px-4 py-20 sm:px-6 md:py-28">
      <div className="mx-auto max-w-6xl">
        {d.title && (
          <h2 className="launch-appear mx-auto mb-16 max-w-2xl text-balance text-center text-3xl font-bold sm:text-5xl">
            {d.title}
          </h2>
        )}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {d.items.map((item, i) => (
            <article
              key={i}
              className="flex flex-col overflow-hidden rounded-2xl border border-[var(--launch-border)] bg-[var(--launch-card-2)] p-3"
            >
              <SwitchbackMedia item={item} />
              <div className="flex flex-1 flex-col p-3">
                <h3 className="text-xl font-bold text-[var(--launch-fg)]">{item.heading}</h3>
                <p className="mt-3 flex-1 leading-relaxed text-[var(--launch-muted)]">{item.body}</p>
                {item.buttonLabel && (
                  <a
                    href={item.buttonHref ?? "#lead_form"}
                    className="mt-5 inline-flex items-center gap-2 font-semibold text-[var(--launch-brand)] transition-colors hover:opacity-80"
                  >
                    {item.buttonLabel}
                    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
