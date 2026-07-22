import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Marquee — «стрічка смаків»: a warm, seamlessly looping ribbon of short
 * keywords (signature dishes, ingredients, values). The item list is
 * duplicated back-to-back and translated -50% so the loop never seams, edge
 * gradients dissolve the strip into the band, and a small round dot separates
 * words. Keywords use the Lora display serif (`.font-display`, the de-fonted
 * chain from globals) so the ribbon reads like specials chalked on a menu
 * card. Restaurant has no shared marquee keyframe, so the scroll animation is
 * kept self-contained in an inline <style> (mirrors React2021Marquee) and
 * honours prefers-reduced-motion. Plain server component, no client state.
 *
 * Default: warm sand band, ink serif words, terracotta dots.
 * `band` variant: full terracotta band, cream words, gold dots.
 */
const MARQUEE_KEYFRAMES = `
  .restaurant-marquee-track { animation: restaurant-marquee-scroll 32s linear infinite; }
  @keyframes restaurant-marquee-scroll {
    from { transform: translateX(0); }
    to { transform: translateX(-50%); }
  }
  @media (prefers-reduced-motion: reduce) {
    .restaurant-marquee-track { animation: none; }
  }
`;

function MarqueeTrack({
  items,
  textClass,
  dotClass,
}: {
  items: string[];
  textClass: string;
  dotClass: string;
}) {
  return (
    <div className="restaurant-marquee-track flex w-max items-center gap-10" aria-hidden="true">
      {[...items, ...items].map((item, i) => (
        <span key={i} className="flex flex-none items-center gap-10 whitespace-nowrap">
          <span className={`font-display text-2xl font-semibold ${textClass}`}>{item}</span>
          <span className={`h-1.5 w-1.5 flex-none rounded-full ${dotClass}`} />
        </span>
      ))}
    </div>
  );
}

export default function RestaurantMarquee({ data }: { data: unknown }) {
  const d = data as BlockProps["marquee"];

  return (
    <section className="bg-[#F3EADD] py-12 sm:py-16">
      {d.title && (
        <p className="mb-8 px-6 text-center text-sm font-semibold uppercase tracking-wide text-[#C0562F]">
          {d.title}
        </p>
      )}

      <div className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-[#F3EADD] to-transparent sm:w-32"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-[#F3EADD] to-transparent sm:w-32"
          aria-hidden="true"
        />
        <MarqueeTrack items={d.items} textClass="text-[#2A2018]" dotClass="bg-[#C0562F]" />
      </div>

      <style>{MARQUEE_KEYFRAMES}</style>
    </section>
  );
}

export function RestaurantMarqueeBand({ data }: { data: unknown }) {
  const d = data as BlockProps["marquee"];

  return (
    <section className="bg-[#C0562F] py-12 sm:py-16">
      {d.title && (
        <p className="mb-8 px-6 text-center text-sm font-semibold uppercase tracking-wide text-[#FBF6EF]/80">
          {d.title}
        </p>
      )}

      <div className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-[#C0562F] to-transparent sm:w-32"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-[#C0562F] to-transparent sm:w-32"
          aria-hidden="true"
        />
        <MarqueeTrack items={d.items} textClass="text-[#FBF6EF]" dotClass="bg-[#B7791F]" />
      </div>

      <style>{MARQUEE_KEYFRAMES}</style>
    </section>
  );
}
