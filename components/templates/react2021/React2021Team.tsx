import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Team — the real people of the business, a section the source react-2021
 * template lacks. Built from its Features/Product palette: coral uppercase
 * kicker + alternating-word title over a responsive grid of clean white
 * cards. Each card centres a circular avatar ringed in coral (echoing the
 * square coral-bordered icons), the name in dark ink, the role as a small
 * coral uppercase tag, and an optional gray bio. §4.8: the photo comes from
 * props only; without one the avatar falls back to a coral-tint initials
 * badge (same convention as Testimonials).
 */
function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export default function React2021Team({ data }: { data: unknown }) {
  const d = data as BlockProps["team"];

  return (
    <section className="bg-gray-50 py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="lg:text-center">
          <span className="text-sm font-semibold uppercase tracking-wide text-[#ec4755]">
            Наша команда
          </span>
          {d.title && (
            <p className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
              {d.title.split(" ").map((word, i) => (
                <span
                  key={i}
                  className={i % 2 ? "text-[#ec4755]" : "text-[#1a2e35]"}
                >
                  {word}{" "}
                </span>
              ))}
            </p>
          )}
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {d.items.map((member, i) => (
            <div
              key={i}
              className="flex flex-col items-center rounded-xl bg-white p-8 text-center shadow-sm"
            >
              {member.photo ? (
                <img
                  src={member.photo}
                  alt={member.name}
                  className="h-28 w-28 rounded-full object-cover ring-4 ring-[#ec4755]/20"
                />
              ) : (
                <div className="flex h-28 w-28 items-center justify-center rounded-full bg-[#ec4755]/10 text-2xl font-extrabold text-[#ec4755] ring-4 ring-[#ec4755]/20">
                  {initials(member.name)}
                </div>
              )}

              <h3 className="mt-5 text-lg font-bold text-[#1a2e35]">{member.name}</h3>
              {member.role && (
                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[#ec4755]">
                  {member.role}
                </p>
              )}
              {member.bio && (
                <p className="mt-3 text-sm leading-relaxed text-gray-500">
                  {member.bio}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
