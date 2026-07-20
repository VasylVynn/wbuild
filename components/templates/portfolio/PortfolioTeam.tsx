import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Team — the real people of the business as glass cards. Distinct from the
 * TESTIMONIALS quote grid (left-aligned quote marks) and SERVICES cards
 * (icon chips): here each card is centred around a circular portrait whose
 * teal ring lights up on hover, above a serif name, a teal role line and an
 * optional muted bio. §4.8 — photo is prop-only, degrading to a teal monogram
 * chip when absent. Plain server component, no client state.
 */
export default function PortfolioTeam({ data }: { data: unknown }) {
  const d = data as BlockProps["team"];

  return (
    <section
      className="py-16 sm:py-24"
      aria-labelledby={d.title ? "portfolio-team-title" : undefined}
    >
      <div className="container mx-auto px-6">
        {d.title && (
          <div className="mx-auto mb-12 max-w-2xl text-center animate-fade-in sm:mb-16">
            <h2
              id="portfolio-team-title"
              className="font-serif text-3xl font-bold sm:text-4xl md:text-5xl"
            >
              {d.title}
            </h2>
            <div className="mx-auto mt-5 h-px w-16 bg-highlight/60" />
          </div>
        )}

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {d.items.map((member, i) => (
            <div
              key={i}
              className="group animate-fade-in rounded-2xl glass p-6 text-center transition-transform duration-300 hover:-translate-y-1 sm:p-8"
              style={{ animationDelay: `${(i + 1) * 100}ms` }}
            >
              <div className="mx-auto h-24 w-24 overflow-hidden rounded-full ring-2 ring-border transition-colors duration-300 group-hover:ring-primary/60">
                {member.photo ? (
                  <img
                    src={member.photo}
                    alt={member.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span
                    className="flex h-full w-full items-center justify-center bg-primary/10 font-serif text-3xl text-primary"
                    aria-hidden="true"
                  >
                    {member.name.trim().charAt(0)}
                  </span>
                )}
              </div>

              <h3 className="font-serif mt-5 text-xl font-bold">{member.name}</h3>
              {member.role && <p className="mt-1 text-sm text-primary">{member.role}</p>}
              {member.bio && (
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{member.bio}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
