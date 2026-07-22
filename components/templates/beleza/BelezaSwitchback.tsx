import type { BlockProps } from "@/lib/blocks/schema";
import { Reveal } from "@/components/templates/shared/reveal";
import { ArrowIcon } from "./icons";

/*
 * Switchback — alternating "photo + text" storytelling rows (zig-zag): the
 * space, the craft, the "до / після" transformations. Each row pairs a soft
 * rounded photo with a rounded-display heading, muted body and an optional
 * inline rose arrow link; rows flip side every other item (lg only). §4.8:
 * images come only from props — a missing one degrades to the shared rose
 * fallback panel, never a broken <img>. Server component with Reveal islands.
 */
type SwitchbackData = BlockProps["switchback"];
type Item = SwitchbackData["items"][number];

function SwitchbackMedia({ item, className }: { item: Item; className: string }) {
  if (item.imageUrl) {
    return <img src={item.imageUrl} alt={item.heading} className={`w-full object-cover ${className}`} />;
  }
  return <div className={`beleza-media-fallback ${className}`} aria-hidden="true" />;
}

export default function BelezaSwitchback({ data }: { data: unknown }) {
  const d = data as SwitchbackData;

  return (
    <section id="switchback" className="beleza-section">
      <div className="beleza-container">
        {d.title && (
          <Reveal className="mb-12 md:mb-16">
            <h2 className="beleza-kicker">
              <strong>{d.title}</strong> Кожна історія — про турботу, увагу до деталей і результат, яким хочеться ділитися.
            </h2>
          </Reveal>
        )}

        <div className="space-y-16 sm:space-y-20">
          {d.items.map((item, i) => (
            <Reveal key={i}>
              <div className={`flex flex-col gap-8 lg:flex-row lg:items-center lg:gap-16 ${i % 2 === 1 ? "lg:flex-row-reverse" : ""}`}>
                <div className="lg:w-1/2">
                  <SwitchbackMedia item={item} className="aspect-[4/3] rounded-3xl shadow-[0_18px_44px_-24px_rgba(41,36,31,0.5)]" />
                </div>
                <div className="lg:w-1/2">
                  <h3 className="beleza-ink text-2xl font-semibold md:text-3xl">{item.heading}</h3>
                  <p className="beleza-muted mt-4 leading-relaxed">{item.body}</p>
                  {item.buttonLabel && (
                    <a href={item.buttonHref ?? "#lead_form"} className="beleza-accent mt-6 inline-flex items-center gap-2 font-semibold transition-opacity hover:opacity-80">
                      {item.buttonLabel}
                      <ArrowIcon className="h-[18px] w-[18px]" />
                    </a>
                  )}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/*
 * Variant "cards" — the same stories as soft rounded cards in a grid (no
 * zig-zag): each card stacks a rounded photo (or rose fallback, §4.8) over a
 * heading, muted body and an optional rose arrow link.
 */
export function BelezaSwitchbackCards({ data }: { data: unknown }) {
  const d = data as SwitchbackData;

  return (
    <section id="switchback" className="beleza-section">
      <div className="beleza-container">
        {d.title && (
          <Reveal className="mb-12 md:mb-16">
            <h2 className="beleza-kicker">
              <strong>{d.title}</strong> Кожна історія — про турботу, увагу до деталей і результат, яким хочеться ділитися.
            </h2>
          </Reveal>
        )}

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {d.items.map((item, i) => (
            <Reveal key={i} delay={i * 0.05}>
              <article className="beleza-card h-full overflow-hidden !p-0">
                <SwitchbackMedia item={item} className="aspect-[4/3]" />
                <div className="flex flex-1 flex-col p-6">
                  <h3 className="beleza-ink text-xl font-semibold">{item.heading}</h3>
                  <p className="beleza-muted mt-3 flex-1 leading-relaxed">{item.body}</p>
                  {item.buttonLabel && (
                    <a
                      href={item.buttonHref ?? "#lead_form"}
                      className="beleza-accent mt-5 inline-flex items-center gap-2 font-semibold transition-opacity hover:opacity-80"
                    >
                      {item.buttonLabel}
                      <ArrowIcon className="h-[18px] w-[18px]" />
                    </a>
                  )}
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
