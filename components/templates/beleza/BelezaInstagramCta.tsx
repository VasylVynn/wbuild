import type { BlockProps } from "@/lib/blocks/schema";
import { normalizeIgHandle } from "@/lib/blocks/contact-links";
import { formatFollowers } from "@/components/blocks/InstagramCta";
import { Reveal } from "@/components/templates/shared/reveal";

/*
 * InstagramCta — the `instagram_cta` block in beleza dress: the same rose
 * branding band as BelezaCTA (blurred white glows, centred copy) with a
 * contained light «Написати в Direct» button, the @handle and the follower
 * count as social proof. Handle/followers are grounded facts (assemble()).
 */
export default function BelezaInstagramCta({ data }: { data: unknown }) {
  const d = data as BlockProps["instagram_cta"];
  const clean = normalizeIgHandle(d.handle);
  if (!clean) return null;

  return (
    <section className="beleza-section">
      <div className="beleza-container">
        <Reveal>
          <div
            className="relative overflow-hidden rounded-3xl px-6 py-14 text-center md:px-12 md:py-16"
            style={{ background: "var(--beleza-branding)", color: "var(--beleza-branding-fg)" }}
          >
            <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
            <div className="absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
            <div className="relative mx-auto max-w-2xl">
              <h2 className="text-3xl font-bold leading-tight md:text-4xl">{d.title ?? "Ми в Instagram"}</h2>
              {d.subtitle && (
                <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-white/85 md:text-lg">{d.subtitle}</p>
              )}
              <a
                href={`https://ig.me/m/${clean}`}
                target="_blank"
                rel="noopener"
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3 text-sm font-bold text-[color:var(--beleza-branding)] transition-transform hover:-translate-y-0.5"
              >
                {d.buttonLabel ?? "Написати в Direct"}
              </a>
              <p className="mt-4 text-sm text-white/85">
                <a
                  href={`https://www.instagram.com/${clean}`}
                  target="_blank"
                  rel="noopener"
                  className="font-bold text-white"
                >
                  @{clean}
                </a>
                {d.followersCount ? ` · ${formatFollowers(d.followersCount)}` : null}
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
