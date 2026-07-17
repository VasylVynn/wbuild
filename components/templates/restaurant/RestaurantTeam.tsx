import type { BlockProps } from "@/lib/blocks/schema";

// Initials fallback avatar — first letters of up to two name parts, e.g. "Марія Коваль" → "МК".
function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

/*
 * Team (chefs) — responsive grid of warm white cards on the cream canvas,
 * each with a circular photo (or a sand-tinted terracotta initials badge
 * when no photo is given), a serif ink name, terracotta role, and optional
 * taupe bio. Mirrors SalonTeam's field/guard logic exactly.
 */
export default function RestaurantTeam({ data }: { data: unknown }) {
  const d = data as BlockProps["team"];

  return (
    <section className="py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {d.title && (
          <h2 className="mb-12 text-center text-3xl font-bold text-[#2A2018] md:text-4xl">
            {d.title}
          </h2>
        )}

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {d.items.map((item, index) => (
            <div
              key={index}
              className="flex h-full flex-col items-center rounded-2xl bg-white p-8 text-center shadow-[0_4px_24px_rgba(42,32,24,0.08)]"
            >
              {item.photo ? (
                <img
                  src={item.photo}
                  alt={item.name}
                  className="mb-5 h-28 w-28 rounded-full object-cover"
                />
              ) : (
                <div className="mb-5 flex h-28 w-28 items-center justify-center rounded-full bg-[#F3EADD] text-3xl font-semibold text-[#C0562F]">
                  {initials(item.name)}
                </div>
              )}

              <h3 className="text-xl font-semibold text-[#2A2018]">{item.name}</h3>

              {item.role && (
                <p className="mt-1 text-sm font-medium uppercase tracking-wide text-[#C0562F]">
                  {item.role}
                </p>
              )}

              {item.bio && <p className="mt-4 leading-relaxed text-[#6F6257]">{item.bio}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
