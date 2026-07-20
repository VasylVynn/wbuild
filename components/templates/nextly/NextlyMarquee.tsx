import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Marquee — nextly-styled scrolling keyword strip: a soft gray band with bold
 * gray keywords and indigo dot separators, the track duplicated 2x for a
 * seamless -50% translateX loop. Reuses the unscoped `portfolioMarquee`
 * keyframe (globals.css) via a Tailwind arbitrary animation value — no global
 * CSS change and no new deps. Edge-fading gradients match the band surface in
 * both themes. Plain server component; the animated track is aria-hidden
 * (decorative motion), matching AiSaasMarquee.
 */
export default function NextlyMarquee({ data }: { data: unknown }) {
  const d = data as BlockProps["marquee"];

  return (
    <section className="bg-gray-50 py-14 dark:bg-neutral-800 sm:py-16">
      {d.title && (
        <p className="mb-8 px-6 text-center text-sm font-bold tracking-wider text-indigo-600 uppercase">
          {d.title}
        </p>
      )}

      <div className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-gray-50 to-transparent dark:from-neutral-800 sm:w-32"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-gray-50 to-transparent dark:from-neutral-800 sm:w-32"
          aria-hidden="true"
        />

        <div
          className="flex w-max items-center gap-10 animate-[portfolioMarquee_30s_linear_infinite] motion-reduce:animate-none"
          aria-hidden="true"
        >
          {[...d.items, ...d.items].map((item, i) => (
            <span key={i} className="flex flex-none items-center gap-10 whitespace-nowrap">
              <span className="text-xl font-semibold text-gray-800 dark:text-gray-200">
                {item}
              </span>
              <span className="h-1.5 w-1.5 flex-none rounded-full bg-indigo-500" />
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
