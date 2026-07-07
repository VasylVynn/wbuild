import type { BlockProps } from "@/lib/blocks/schema";

export default function Hero({ data }: { data: BlockProps["hero"] }) {
  const { eyebrow, title, subtitle, imageUrl, ctaLabel, ctaHref } = data;

  return (
    <section
      style={{
        backgroundColor: "var(--color-primary)",
        color: "var(--color-primary-foreground)",
      }}
    >
      <div className="mx-auto max-w-5xl px-4 py-16">
        <div className="flex flex-col gap-8 md:flex-row md:items-center">
          {/* Text column */}
          <div className="flex-1 space-y-6">
            {eyebrow && (
              <p
                className="text-sm font-semibold uppercase tracking-widest"
                style={{ color: "var(--color-primary-foreground)", opacity: 0.75 }}
              >
                {eyebrow}
              </p>
            )}

            <h1
              className="text-4xl font-bold leading-tight md:text-5xl"
              style={{ fontFamily: "var(--font-heading)", color: "var(--color-primary-foreground)" }}
            >
              {title}
            </h1>

            {subtitle && (
              <p
                className="text-xl leading-relaxed"
                style={{ color: "var(--color-primary-foreground)", opacity: 0.9 }}
              >
                {subtitle}
              </p>
            )}

            {ctaLabel && (
              <a
                href={ctaHref ?? "#"}
                className="inline-block rounded-[var(--radius)] px-8 py-4 text-lg font-semibold"
                style={{
                  backgroundColor: "var(--color-background)",
                  color: "var(--color-primary)",
                }}
              >
                {ctaLabel}
              </a>
            )}
          </div>

          {/* Image column */}
          {imageUrl && (
            <div className="flex-1">
              <img
                src={imageUrl}
                alt=""
                loading="lazy"
                className="w-full rounded-[var(--radius)] object-cover"
                style={{ maxHeight: "480px" }}
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
