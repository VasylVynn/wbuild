import type { BlockProps } from "@/lib/blocks/schema";
import { ArrowIcon, CalendarIcon, CheckIcon, SparkleIcon } from "./icons";

/*
 * Hero — soft beauty-space intro faithful to the source: a rose badge, a big
 * rounded-display headline (with an optional accent tail), a muted subtitle, a
 * rose primary + ghost secondary CTA and a row of generic value chips (never
 * fabricated ratings/facts). §4.8: the photo comes only from props; a missing
 * one degrades to the shared rose fallback panel, never a broken <img>.
 *
 * Above the fold → rendered statically visible (no JS-gated reveal), so it is
 * honest without JavaScript (H5).
 *
 * Default:  copy-left / image-right with a floating "запис" card.
 * `split`:  image-left / copy-right on a full rose-tint band.
 * `center`: centered stacked copy with a wide image (or panel) beneath.
 */
type HeroData = BlockProps["hero"];

const TRUST = ["Зручний онлайн-запис", "Підтвердження у Telegram", "Затишна атмосфера"];

function HeroBadge({ eyebrow }: { eyebrow?: string }) {
  return (
    <span className="beleza-badge">
      <SparkleIcon className="h-3.5 w-3.5 text-[color:var(--beleza-branding)]" />
      <span>{eyebrow || "Простір краси"}</span>
    </span>
  );
}

function HeroCtas({ d, className = "" }: { d: HeroData; className?: string }) {
  if (!d.ctaLabel && !d.secondaryCtaLabel) return null;
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {d.ctaLabel && (
        <a href={d.ctaHref ?? "#lead_form"} className="beleza-btn">
          {d.ctaLabel}
          <ArrowIcon className="h-4 w-4" />
        </a>
      )}
      {d.secondaryCtaLabel && (
        <a href={d.secondaryCtaHref ?? "#services"} className="beleza-btn beleza-btn--ghost">
          {d.secondaryCtaLabel}
        </a>
      )}
    </div>
  );
}

function TrustRow({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex flex-wrap items-center gap-x-5 gap-y-2 border-t pt-6 ${className}`}
      style={{ borderColor: "var(--beleza-border-subtle)" }}
    >
      {TRUST.map((t) => (
        <div key={t} className="beleza-muted flex items-center gap-1.5 text-sm">
          <CheckIcon className="h-4 w-4 shrink-0 text-[color:var(--beleza-branding)]" />
          <span>{t}</span>
        </div>
      ))}
    </div>
  );
}

function HeroMedia({ d, className }: { d: HeroData; className: string }) {
  if (d.imageUrl) {
    return <img src={d.imageUrl} alt={d.imageAlt ?? d.title} className={`w-full object-cover ${className}`} />;
  }
  return <div className={`beleza-media-fallback ${className}`} aria-hidden="true" />;
}

function FloatingCard() {
  return (
    <div
      className="absolute inset-x-4 bottom-4 flex items-center gap-3 rounded-xl border bg-white/90 p-3 backdrop-blur-sm"
      style={{ borderColor: "var(--beleza-border-subtle)" }}
    >
      <span className="beleza-chip !h-9 !w-9">
        <CalendarIcon className="h-5 w-5" />
      </span>
      <div>
        <p className="beleza-ink text-xs font-semibold">Вільні місця цього тижня</p>
        <p className="beleza-muted text-xs">Запис у кілька дотиків</p>
      </div>
    </div>
  );
}

export default function BelezaHero({ data }: { data: unknown }) {
  const d = data as HeroData;

  return (
    <section className="beleza-section !pt-10">
      <div className="beleza-container grid items-center gap-10 lg:grid-cols-[3fr_2fr] lg:gap-16">
        <div className="flex flex-col items-start text-left">
          <HeroBadge eyebrow={d.eyebrow} />
          <h1 className="beleza-ink mt-6 max-w-[20ch] text-[2rem] font-bold leading-[1.1] md:text-[2.9rem]">
            {d.title}
            {d.titleAccent && <span className="beleza-accent"> {d.titleAccent}</span>}
          </h1>
          {d.subtitle && <p className="beleza-muted mt-4 max-w-md text-base leading-relaxed sm:text-lg">{d.subtitle}</p>}
          <HeroCtas d={d} className="mt-8" />
          <TrustRow className="mt-8" />
        </div>

        <div className="relative">
          <div className="relative overflow-hidden rounded-2xl shadow-xl">
            <HeroMedia d={d} className="h-[240px] sm:h-[320px] lg:h-[440px]" />
            <FloatingCard />
          </div>
        </div>
      </div>
    </section>
  );
}

export function BelezaHeroSplit({ data }: { data: unknown }) {
  const d = data as HeroData;

  return (
    <section className="beleza-section beleza-tint !py-0">
      <div className="beleza-container grid items-center gap-10 py-14 md:py-20 lg:grid-cols-2 lg:gap-16">
        <div className="order-2 lg:order-1">
          <div className="relative overflow-hidden rounded-3xl shadow-xl">
            <HeroMedia d={d} className="h-[260px] sm:h-[360px] lg:h-[480px]" />
          </div>
        </div>
        <div className="order-1 flex flex-col items-start text-left lg:order-2">
          <HeroBadge eyebrow={d.eyebrow} />
          <h1 className="beleza-ink mt-6 max-w-[18ch] text-[2rem] font-bold leading-[1.1] md:text-[3rem]">
            {d.title}
            {d.titleAccent && <span className="beleza-accent"> {d.titleAccent}</span>}
          </h1>
          {d.subtitle && <p className="beleza-muted mt-4 max-w-md text-base leading-relaxed sm:text-lg">{d.subtitle}</p>}
          <HeroCtas d={d} className="mt-8" />
          <TrustRow className="mt-8" />
        </div>
      </div>
    </section>
  );
}

export function BelezaHeroCenter({ data }: { data: unknown }) {
  const d = data as HeroData;

  return (
    <section className="beleza-section !pt-10">
      <div className="beleza-container flex flex-col items-center text-center">
        <HeroBadge eyebrow={d.eyebrow} />
        <h1 className="beleza-ink mt-6 max-w-[16ch] text-[2.1rem] font-bold leading-[1.1] md:text-[3.2rem]">
          {d.title}
          {d.titleAccent && <span className="beleza-accent"> {d.titleAccent}</span>}
        </h1>
        {d.subtitle && <p className="beleza-muted mt-4 max-w-xl text-base leading-relaxed sm:text-lg">{d.subtitle}</p>}
        <HeroCtas d={d} className="mt-8 justify-center" />
        <div className="mt-12 w-full overflow-hidden rounded-3xl shadow-xl">
          <HeroMedia d={d} className="h-[240px] sm:h-[360px] lg:h-[460px]" />
        </div>
      </div>
    </section>
  );
}
