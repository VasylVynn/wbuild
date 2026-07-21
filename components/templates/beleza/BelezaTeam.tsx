import type { BlockProps } from "@/lib/blocks/schema";
import { Reveal } from "@/components/templates/shared/reveal";

/*
 * Team — the space's real masters (майстрині). Photo comes only from props
 * (§4.8); a missing one degrades to a soft rose initials medallion, never a
 * broken <img>. Server component with Reveal islands.
 */
type TeamData = BlockProps["team"];
type Member = TeamData["items"][number];

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function Portrait({ member }: { member: Member }) {
  if (member.photo) {
    return <img src={member.photo} alt={member.name} className="aspect-[4/5] w-full rounded-2xl object-cover" />;
  }
  return (
    <div className="flex aspect-[4/5] w-full items-center justify-center rounded-2xl" style={{ background: "var(--beleza-brand-1)" }}>
      <span className="text-3xl font-bold text-[color:var(--beleza-branding)]" style={{ fontFamily: "var(--beleza-display)" }}>
        {initials(member.name)}
      </span>
    </div>
  );
}

export default function BelezaTeam({ data }: { data: unknown }) {
  const d = data as TeamData;

  return (
    <section id="team" className="beleza-section">
      <div className="beleza-container">
        {d.title && (
          <Reveal className="mb-12 md:mb-16">
            <h2 className="beleza-kicker">
              <strong>{d.title}</strong> Майстрині, яким можна довіритися.
            </h2>
          </Reveal>
        )}
        <div className="grid grid-cols-2 gap-5 md:grid-cols-4 md:gap-6">
          {d.items.map((member, i) => (
            <Reveal key={i} delay={i * 0.05}>
              <article className="flex h-full flex-col">
                <Portrait member={member} />
                <h3 className="beleza-ink mt-4 text-base font-semibold">{member.name}</h3>
                {member.role && <p className="beleza-accent text-sm font-medium">{member.role}</p>}
                {member.bio && <p className="beleza-muted mt-1.5 text-sm leading-relaxed">{member.bio}</p>}
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
