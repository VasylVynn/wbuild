import type { BlockProps } from "@/lib/blocks/schema";
import { ServiceIcon } from "./icons";

/*
 * Services — the Launch feature grid. §4.8: an item's photo shows only from
 * `item.imageUrl`; otherwise a brand icon chip (schema `icon` enum) carries it.
 *
 * Default: glass feature cards (icon/photo + name + badge + description + price).
 * `list` variant: a pricing list — name/description left, price right — for
 * services where the price is the headline.
 */
function SectionHeader({ title }: { title?: string }) {
  if (!title) return null;
  return (
    <h2 className="launch-appear mx-auto mb-14 max-w-2xl text-balance text-center text-3xl font-bold sm:text-5xl">
      {title}
    </h2>
  );
}

export default function LaunchServices({ data }: { data: unknown }) {
  const d = data as BlockProps["services"];

  return (
    <section className="relative px-4 py-20 sm:px-6 md:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeader title={d.title} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {d.items.map((item, i) => (
            <div key={i} className="launch-glass flex flex-col rounded-2xl p-6">
              {item.imageUrl ? (
                <div className="mb-5 overflow-hidden rounded-xl">
                  <img src={item.imageUrl} alt={item.name} className="aspect-[16/10] w-full object-cover" />
                </div>
              ) : (
                <span className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--launch-border)] bg-[var(--launch-input)] text-[var(--launch-brand)]">
                  <ServiceIcon name={item.icon} />
                </span>
              )}
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-[var(--launch-fg)]">{item.name}</h3>
                {item.badge && (
                  <span className="rounded-full border border-[var(--launch-brand)]/40 px-2 py-0.5 text-[11px] font-semibold text-[var(--launch-brand)]">
                    {item.badge}
                  </span>
                )}
              </div>
              {item.description && (
                <p className="mt-2 flex-1 text-sm leading-relaxed text-[var(--launch-muted)]">{item.description}</p>
              )}
              {item.price && (
                <p className="mt-4 text-lg font-bold text-[var(--launch-brand)]">{item.price}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LaunchServicesList({ data }: { data: unknown }) {
  const d = data as BlockProps["services"];

  return (
    <section className="relative px-4 py-20 sm:px-6 md:py-28">
      <div className="mx-auto max-w-3xl">
        <SectionHeader title={d.title} />
        <div className="launch-glass divide-y divide-[var(--launch-border)] overflow-hidden rounded-2xl">
          {d.items.map((item, i) => (
            <div key={i} className="flex items-start gap-4 p-5 sm:p-6">
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--launch-border)] bg-[var(--launch-input)] text-[var(--launch-brand)]">
                <ServiceIcon name={item.icon} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-[var(--launch-fg)]">{item.name}</h3>
                  {item.badge && (
                    <span className="rounded-full border border-[var(--launch-brand)]/40 px-2 py-0.5 text-[11px] font-semibold text-[var(--launch-brand)]">
                      {item.badge}
                    </span>
                  )}
                </div>
                {item.description && (
                  <p className="mt-1 text-sm leading-relaxed text-[var(--launch-muted)]">{item.description}</p>
                )}
              </div>
              {item.price && (
                <p className="shrink-0 whitespace-nowrap text-base font-bold text-[var(--launch-brand)]">{item.price}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
