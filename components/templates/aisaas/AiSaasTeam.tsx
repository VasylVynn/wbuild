import type { BlockProps } from "@/lib/blocks/schema";

// Initials fallback avatar — first letters of up to two name parts, e.g.
// "Марія Коваль" → "МК". Used when a member has no photo (§4.8).
function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

/*
 * Team — a friendly "meet the team" grid of soft rounded-3xl lavender cards,
 * each led by a circular photo or (when none) a pastel initials badge whose
 * chip colour alternates blue/peach like the bento highlights. Name in ink,
 * coral role, muted bio. §4.8: photos come from props only; no photo → the
 * initials badge, never a broken <img>. Plain server component.
 */
export default function AiSaasTeam({ data }: { data: unknown }) {
  const d = data as BlockProps["team"];

  return (
    <section className="bg-white py-16">
      <div className="mx-auto max-w-6xl px-4">
        {d.title && (
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <span className="mb-3 inline-block text-sm font-semibold text-[#E07A5F]">Команда</span>
            <h2 className="text-3xl font-bold text-[#2F4550] md:text-4xl">{d.title}</h2>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {d.items.map((item, i) => {
            const chipClass = i % 2 === 0 ? "bg-[#D3E4FD] text-[#3D8690]" : "bg-[#FDE1D3] text-[#E07A5F]";

            return (
              <div
                key={i}
                className="flex h-full flex-col items-center rounded-3xl bg-[#F1F0FB] p-8 text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
              >
                {item.photo ? (
                  <img
                    src={item.photo}
                    alt={item.name}
                    className="mb-5 h-28 w-28 rounded-full object-cover"
                  />
                ) : (
                  <div
                    className={`mb-5 flex h-28 w-28 items-center justify-center rounded-full text-3xl font-bold ${chipClass}`}
                  >
                    {initials(item.name)}
                  </div>
                )}

                <h3 className="text-lg font-bold text-[#2F4550]">{item.name}</h3>
                {item.role && <p className="mt-1 text-sm font-semibold text-[#E07A5F]">{item.role}</p>}
                {item.bio && (
                  <p className="mt-3 text-sm leading-relaxed text-[#2F4550]/80">{item.bio}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
