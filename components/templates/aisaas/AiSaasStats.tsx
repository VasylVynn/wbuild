import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Stats — port of the source stats section's number band, minus the
 * count-up animation (schema values are already-formatted strings, not
 * numbers to tween) and the lucide icons. A soft `#F1F0FB` band holds a
 * 2x4 grid of big bold coral numbers over muted labels.
 */
export default function AiSaasStats({ data }: { data: unknown }) {
  const d = data as BlockProps["stats"];

  return (
    <section className="py-16">
      <div className="mx-auto max-w-6xl px-4">
        <div className="rounded-3xl bg-[#F1F0FB] px-6 py-12 sm:px-10">
          {d.title && (
            <h2 className="mb-10 text-center text-3xl font-bold text-[#2F4550] md:text-4xl">
              {d.title}
            </h2>
          )}

          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {d.items.map((stat, i) => (
              <div key={i} className="text-center">
                <p className="text-4xl font-bold text-[#E07A5F] md:text-5xl">{stat.value}</p>
                <p className="mt-2 text-sm font-medium text-[#2F4550]/70">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
