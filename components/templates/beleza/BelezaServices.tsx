import type { BlockProps } from "@/lib/blocks/schema";
import { ServiceIcon } from "@/components/blocks/icons";
import { Reveal } from "@/components/templates/shared/reveal";
import { SparkleIcon } from "./icons";

/*
 * Services — the beauty price-list, load-bearing for this vertical. Each item is
 * name + description + a rose PRICE (a fact, copied 1:1), with an optional icon
 * chip and badge. Three layouts share one item shape:
 *
 * Default:  soft card grid (source style) — icon chip, name, description, price,
 *           optional badge, hover lift.
 * `list`:   a printed price-list — name + dotted leader + rose price, the
 *           classic salon menu.
 * `rows`:   compact two-up rows for shorter menus.
 *
 * Server components with client Reveal islands (H5: visible without JS).
 */
type ServicesData = BlockProps["services"];
type ServiceItem = ServicesData["items"][number];

function Kicker({ title }: { title?: string }) {
  if (!title) return null;
  return (
    <Reveal className="mb-12 md:mb-16">
      <h2 className="beleza-kicker">
        <strong>{title}</strong> Дбайливо підібрані процедури для вашої краси й гарного настрою.
      </h2>
    </Reveal>
  );
}

function Chip({ item }: { item: ServiceItem }) {
  return (
    <span className="beleza-chip mb-4">
      {item.icon ? <ServiceIcon name={item.icon} className="h-5 w-5" /> : <SparkleIcon className="h-5 w-5" />}
    </span>
  );
}

export default function BelezaServices({ data }: { data: unknown }) {
  const d = data as ServicesData;

  return (
    <section id="services" className="beleza-section">
      <div className="beleza-container">
        <Kicker title={d.title} />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 md:gap-6">
          {d.items.map((item, i) => (
            <Reveal key={i} delay={i * 0.05}>
              <article className="beleza-card beleza-card--hover relative h-full">
                {item.badge && <span className="beleza-badge beleza-badge--solid absolute right-4 top-4 !py-1 !text-xs">{item.badge}</span>}
                <Chip item={item} />
                <h3 className="beleza-ink text-base font-semibold">{item.name}</h3>
                {item.description && <p className="beleza-muted mt-1.5 flex-1 text-sm leading-relaxed">{item.description}</p>}
                {item.price && <p className="beleza-accent mt-4 text-sm font-bold">{item.price}</p>}
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function BelezaServicesList({ data }: { data: unknown }) {
  const d = data as ServicesData;

  return (
    <section id="services" className="beleza-section">
      <div className="beleza-container">
        <Kicker title={d.title} />
        <div className="grid grid-cols-1 gap-x-12 gap-y-6 lg:grid-cols-2">
          {d.items.map((item, i) => (
            <Reveal key={i} delay={i * 0.04}>
              <div className="border-b border-dashed pb-5" style={{ borderColor: "var(--beleza-border)" }}>
                <div className="flex items-baseline gap-3">
                  <span className="beleza-ink text-lg font-semibold">{item.name}</span>
                  {item.badge && <span className="beleza-badge !py-0.5 !text-xs">{item.badge}</span>}
                  <span className="mx-1 flex-1 border-b border-dotted" style={{ borderColor: "var(--beleza-border)" }} aria-hidden="true" />
                  {item.price && <span className="beleza-accent shrink-0 text-lg font-bold">{item.price}</span>}
                </div>
                {item.description && <p className="beleza-muted mt-1.5 text-sm leading-relaxed">{item.description}</p>}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function BelezaServicesRows({ data }: { data: unknown }) {
  const d = data as ServicesData;

  return (
    <section id="services" className="beleza-section beleza-tint">
      <div className="beleza-container">
        <Kicker title={d.title} />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {d.items.map((item, i) => (
            <Reveal key={i} delay={i * 0.05}>
              <article className="beleza-card beleza-card--hover !flex-row items-start gap-4">
                <span className="beleza-chip shrink-0">
                  {item.icon ? <ServiceIcon name={item.icon} className="h-5 w-5" /> : <SparkleIcon className="h-5 w-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="beleza-ink text-base font-semibold">{item.name}</h3>
                    {item.price && <span className="beleza-accent shrink-0 text-sm font-bold">{item.price}</span>}
                  </div>
                  {item.description && <p className="beleza-muted mt-1 text-sm leading-relaxed">{item.description}</p>}
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
