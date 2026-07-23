import type { BlockProps } from "@/lib/blocks/schema";
import { normalizeIgHandle } from "@/lib/blocks/contact-links";
import { formatFollowers } from "@/components/blocks/InstagramCta";

/*
 * InstagramCta — the `instagram_cta` block in restaurant dress: an olive band
 * (RestaurantCTA's rounded-3xl card language, in the palette's second accent)
 * with a white pill «Написати в Direct» and the @handle + follower proof in
 * warm cream. Handle/followers are grounded facts (assemble()). Server
 * component — no interaction needed.
 */
export default function RestaurantInstagramCta({ data }: { data: unknown }) {
  const d = data as BlockProps["instagram_cta"];
  const clean = normalizeIgHandle(d.handle);
  if (!clean) return null;

  return (
    <section className="bg-[#FBF6EF] py-16 sm:py-20">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-[#5F6F3E] px-6 py-14 text-center md:px-16 md:py-16">
          <h2 className="mb-4 font-serif text-3xl font-bold text-white md:text-4xl">
            {d.title ?? "Ми в Instagram"}
          </h2>

          {d.subtitle && (
            <p className="mx-auto mb-8 max-w-2xl text-lg text-white/85">{d.subtitle}</p>
          )}

          <div className="flex flex-col items-center gap-4">
            <a
              href={`https://ig.me/m/${clean}`}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3 font-semibold text-[#5F6F3E] transition hover:bg-[#FBF6EF]"
            >
              {d.buttonLabel ?? "Написати в Direct"}
            </a>
            <p className="text-sm text-white/85">
              <a
                href={`https://www.instagram.com/${clean}`}
                target="_blank"
                rel="noopener"
                className="font-semibold text-white"
              >
                @{clean}
              </a>
              {d.followersCount ? ` · ${formatFollowers(d.followersCount)}` : null}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
