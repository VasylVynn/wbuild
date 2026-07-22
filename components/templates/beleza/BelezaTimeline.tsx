import type { BlockProps } from "@/lib/blocks/schema";
import { Reveal } from "@/components/templates/shared/reveal";

/*
 * Timeline — "як проходить візит": a walk-through of a visit as a VERTICAL
 * left-rail (a continuous rose line with dot markers and a faded zero-padded
 * index per step). Deliberately different from the salon template's centered
 * horizontal-connector process — a calm, readable single column. Sits on the
 * rose tint band, echoing the source's "how it works". Server component.
 */
type TimelineData = BlockProps["timeline"];

export default function BelezaTimeline({ data }: { data: unknown }) {
  const d = data as TimelineData;

  return (
    <section id="timeline" className="beleza-section beleza-tint">
      <div className="beleza-container">
        {d.title && (
          <Reveal className="mb-12 md:mb-16">
            <h2 className="beleza-kicker">
              <strong>{d.title}</strong> Кілька спокійних кроків — від запису до результату, яким хочеться ділитися.
            </h2>
          </Reveal>
        )}

        <ol className="relative mx-auto max-w-2xl">
          <span className="absolute bottom-2 left-[15px] top-2 w-px" style={{ background: "color-mix(in srgb, var(--beleza-branding) 28%, transparent)" }} aria-hidden="true" />
          {d.items.map((item, i) => (
            <Reveal key={i} delay={i * 0.06}>
              <li className="relative flex gap-6 pb-10 last:pb-0">
                <span className="relative z-10 mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 bg-[var(--beleza-bg)]" style={{ borderColor: "var(--beleza-branding)" }}>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--beleza-branding)" }} />
                </span>
                <div className="min-w-0 flex-1">
                  <span className="text-2xl font-bold leading-none" style={{ fontFamily: "var(--beleza-display)", color: "color-mix(in srgb, var(--beleza-branding) 32%, transparent)" }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {item.period && <span className="beleza-accent ml-3 text-xs font-semibold uppercase tracking-widest">{item.period}</span>}
                  <h3 className="beleza-ink mt-2 text-lg font-semibold">{item.title}</h3>
                  {item.subtitle && <p className="beleza-muted mt-0.5 text-sm font-medium">{item.subtitle}</p>}
                  {item.description && <p className="beleza-muted mt-1.5 text-sm leading-relaxed">{item.description}</p>}
                </div>
              </li>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
