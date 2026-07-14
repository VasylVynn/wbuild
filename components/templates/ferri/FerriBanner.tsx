import type { BlockProps } from "@/lib/blocks/schema";
import { Reveal } from "./Reveal";

/*
 * Banner — a full-width statement band: a large serif pull-quote framed by a
 * decorative gold quote mark and a thin accent rule, no button. Unlike
 * FerriCTA (which drives to action), this section exists purely to break
 * page rhythm with a bold editorial statement.
 */
export default function FerriBanner({ data }: { data: unknown }) {
  const d = data as BlockProps["cta"];

  return (
    <section className="relative overflow-hidden border-y border-gold-500/8 bg-navy-900/40 py-20 sm:py-28 lg:py-32">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(184,150,90,0.05)_0%,_transparent_65%)]" />
      <div className="relative mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
        <Reveal>
          <span
            className="font-[family-name:var(--font-cormorant)] text-6xl leading-none text-gold-500/40 sm:text-7xl"
            aria-hidden="true"
          >
            &ldquo;
          </span>
          <h2 className="mx-auto mt-2 max-w-3xl font-[family-name:var(--font-cormorant)] text-3xl font-light leading-[1.15] text-cream-100 sm:text-4xl md:text-5xl">
            {d.title}
          </h2>
          <span className="mx-auto mt-8 block h-px w-16 bg-gold-500/50" aria-hidden="true" />
          {d.subtitle && (
            <p className="mx-auto mt-8 max-w-xl text-base leading-relaxed text-txt-muted">{d.subtitle}</p>
          )}
        </Reveal>
      </div>
    </section>
  );
}
