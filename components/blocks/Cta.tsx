import type { BlockProps } from "@/lib/blocks/schema";

export default function Cta({ data }: { data: BlockProps["cta"] }) {
  const { title, subtitle, buttonLabel, buttonHref } = data;

  return (
    <section
      style={{
        backgroundColor: "var(--color-primary)",
        color: "var(--color-primary-foreground)",
      }}
    >
      <div className="mx-auto max-w-5xl px-4 py-16">
        <div className="flex flex-col items-center gap-8 text-center">
          <div className="space-y-4">
            <h2
              className="text-3xl font-bold md:text-4xl"
              style={{
                fontFamily: "var(--font-heading)",
                color: "var(--color-primary-foreground)",
              }}
            >
              {title}
            </h2>

            {subtitle && (
              <p
                className="text-xl leading-relaxed"
                style={{ color: "var(--color-primary-foreground)", opacity: 0.9 }}
              >
                {subtitle}
              </p>
            )}
          </div>

          <a
            href={buttonHref ?? "#contacts"}
            className="inline-block px-10 py-5 text-lg font-semibold"
            style={{
              backgroundColor: "var(--color-background)",
              color: "var(--color-primary)",
              borderRadius: "var(--radius)",
            }}
          >
            {buttonLabel}
          </a>
        </div>
      </div>
    </section>
  );
}
