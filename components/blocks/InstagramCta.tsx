import type { BlockProps } from "@/lib/blocks/schema";
import { normalizeIgHandle } from "@/lib/blocks/contact-links";

/**
 * InstagramCta — a prominent «Написати в Direct» conversion path for IG-native
 * businesses (refactor 03 §2.4). ADDITIVE to the lead form (invariant 7), never
 * a replacement. The handle is a fact (facts.instagram) and followersCount comes
 * from the IG snapshot — both grounded deterministically in assemble().
 */

/** «1 підписник / 2 підписники / 5 підписників» — Ukrainian plural forms. */
export function formatFollowers(n: number): string {
  const count = n.toLocaleString("uk-UA");
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} підписник`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} підписники`;
  return `${count} підписників`;
}

export default function InstagramCta({ data }: { data: BlockProps["instagram_cta"] }) {
  const { title, subtitle, handle, followersCount, buttonLabel } = data;
  // The stored handle is already a grounded fact, but it may be freeform
  // («@name», full URL) — normalize for the deep links, render nothing if the
  // handle is unusable (never a broken Direct link).
  const clean = normalizeIgHandle(handle);
  if (!clean) return null;

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
            href={`https://ig.me/m/${clean}`}
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
              href={`https://www.instagram.com/${clean}`}
              target="_blank"
              rel="noopener"
              className="font-semibold"
              style={{ color: "var(--color-primary)" }}
            >
              @{clean}
            </a>
            {followersCount ? ` · ${formatFollowers(followersCount)}` : null}
          </p>
        </div>
      </div>
    </section>
  );
}
