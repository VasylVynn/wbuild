import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Stats — warm terracotta-tinted sand band (#F3EADD) holding a responsive
 * grid of big serif numbers in terracotta, over taupe labels. Mirrors
 * AiSaasStats's structure/guards; values are already-formatted strings from
 * the schema (never invented — only real grounded numbers render).
 */
export default function RestaurantStats({ data }: { data: unknown }) {
  const d = data as BlockProps["stats"];

  return (
    <section className="py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl bg-[#F3EADD] px-6 py-12 shadow-sm sm:px-10">
          {d.title && (
            <h2 className="mb-10 text-center text-3xl font-bold text-[#2A2018] md:text-4xl">
              {d.title}
            </h2>
          )}

          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {d.items.map((stat, i) => (
              <div key={i} className="text-center">
                <p className="text-4xl font-bold text-[#C0562F] md:text-5xl">{stat.value}</p>
                <p className="mt-2 text-sm font-medium text-[#6F6257]">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
