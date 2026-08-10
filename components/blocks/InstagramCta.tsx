import type { BlockProps } from "@/lib/blocks/schema";
import { igDirectHref, instagramHref, normalizeIgHandle } from "@/lib/blocks/contact-links";
import { displayFollowers } from "@/lib/blocks/hygiene";

/**
 * InstagramCta — a prominent «Написати в Direct» conversion path for IG-native
 * businesses (refactor 03 §2.4). ADDITIVE to the lead form (invariant 7), never
 * a replacement. The handle is a fact (facts.instagram) and followersCount comes
 * from the IG snapshot — both grounded deterministically in assemble().
 */

/** Re-exported so the template skins that render a follower count keep one
 *  implementation; the canonical one (plurals + no-break grouping + the display
 *  floor) lives in lib/blocks/hygiene.ts. */
export { formatFollowers } from "@/lib/blocks/hygiene";

export default function InstagramCta({ data }: { data: BlockProps["instagram_cta"] }) {
  const { title, subtitle, handle, followersCount, buttonLabel } = data;
  // The stored handle is already a grounded fact, but it may be freeform
  // («@name», full URL) — normalize for the deep links, render nothing if the
  // handle is unusable (never a broken Direct link).
  const clean = normalizeIgHandle(handle);
  const direct = igDirectHref(clean);
  const profile = instagramHref(clean);
  if (!clean || !direct || !profile) return null;
  const followers = displayFollowers(followersCount);

  return (
    <section
      style={{
        backgroundColor: "var(--color-accent)",
        color: "var(--color-foreground)",
      }}
    >
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h2
          className="text-3xl font-bold md:text-4xl"
          style={{ fontFamily: "var(--font-heading)", color: "var(--color-foreground)" }}
        >
          {title ?? "Ми в Instagram"}
        </h2>
        {subtitle && (
          <p
            className="mx-auto mt-4 max-w-xl text-lg leading-relaxed"
            style={{ color: "var(--color-muted-foreground)" }}
          >
            {subtitle}
          </p>
        )}

        <div className="mt-8 flex flex-col items-center gap-4">
          <a
            href={direct}
            target="_blank"
            rel="noopener"
            className="inline-flex min-h-[44px] items-center justify-center rounded-full px-8 py-3 text-lg font-semibold"
            style={{
              backgroundColor: "var(--color-primary)",
              color: "var(--color-primary-foreground)",
            }}
          >
            {buttonLabel ?? "Написати в Direct"}
          </a>
          <p className="text-base" style={{ color: "var(--color-muted-foreground)" }}>
            <a
              href={profile}
              target="_blank"
              rel="noopener"
              className="font-semibold"
              style={{ color: "var(--color-primary)" }}
            >
              @{clean}
            </a>
            {followers ? ` · ${followers}` : null}
          </p>
        </div>
      </div>
    </section>
  );
}
