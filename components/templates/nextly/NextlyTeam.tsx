import type { BlockProps } from "@/lib/blocks/schema";

// Initials fallback avatar — first letters of up to two name parts.
function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

/*
 * Team — responsive grid of member cards matching nextly's Services/Testimonials
 * card language (gray-50/neutral-800 rounded-2xl panels). Photo renders as a
 * plain rounded <img>; otherwise an indigo initials circle stands in, same
 * pattern as NextlyTestimonials' avatar badge. Header follows the shared
 * indigo eyebrow + bold heading convention.
 */
export default function NextlyTeam({ data }: { data: unknown }) {
  const d = data as BlockProps["team"];

  return (
    <section className="bg-white py-16 dark:bg-neutral-900 lg:py-20">
      <div className="mx-auto max-w-7xl px-4">
        {d.title && (
          <div className="mx-auto mb-12 flex max-w-2xl flex-col items-center text-center">
            <span className="text-sm font-bold tracking-wider text-indigo-600 uppercase">
              Наша команда
            </span>
            <h2 className="mt-3 text-3xl font-bold leading-snug tracking-tight text-gray-800 lg:text-4xl lg:leading-tight dark:text-white">
              {d.title}
            </h2>
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {d.items.map((item, i) => (
            <div
              key={i}
              className="flex flex-col items-center rounded-2xl bg-gray-50 p-6 text-center transition-shadow duration-300 hover:shadow-lg dark:bg-neutral-800 sm:p-8"
            >
              {item.photo ? (
                <img
                  src={item.photo}
                  alt={item.name}
                  className="mb-5 h-24 w-24 rounded-full object-cover"
                />
              ) : (
                <div className="mb-5 flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-2xl font-semibold text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200">
                  {initials(item.name)}
                </div>
              )}

              <h4 className="text-xl font-bold text-gray-800 dark:text-white">{item.name}</h4>
              {item.role && (
                <p className="mt-1 text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                  {item.role}
                </p>
              )}
              {item.bio && (
                <p className="mt-3 text-gray-500 dark:text-gray-400">{item.bio}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
