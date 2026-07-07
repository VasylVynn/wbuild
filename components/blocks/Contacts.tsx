import type { BlockProps } from "@/lib/blocks/schema";

export default function Contacts({ data }: { data: BlockProps["contacts"] }) {
  const { title, phone, address, hours, email } = data;

  return (
    <section
      style={{
        backgroundColor: "var(--color-primary)",
        color: "var(--color-primary-foreground)",
      }}
    >
      <div className="mx-auto max-w-5xl px-4 py-16">
        {title && (
          <h2
            className="mb-12 text-3xl font-bold md:text-4xl"
            style={{ fontFamily: "var(--font-heading)", color: "var(--color-primary-foreground)" }}
          >
            {title}
          </h2>
        )}

        <dl className="flex flex-col gap-8 md:flex-row md:gap-16">
          {phone && (
            <div className="flex flex-col gap-1">
              <dt
                className="text-sm font-semibold uppercase tracking-widest"
                style={{ color: "var(--color-primary-foreground)", opacity: 0.75 }}
              >
                Телефон
              </dt>
              <dd>
                <a
                  href={`tel:${phone.replace(/\s/g, "")}`}
                  className="text-2xl font-semibold"
                  style={{ color: "var(--color-primary-foreground)" }}
                >
                  {phone}
                </a>
              </dd>
            </div>
          )}

          {address && (
            <div className="flex flex-col gap-1">
              <dt
                className="text-sm font-semibold uppercase tracking-widest"
                style={{ color: "var(--color-primary-foreground)", opacity: 0.75 }}
              >
                Адреса
              </dt>
              <dd
                className="text-xl"
                style={{ color: "var(--color-primary-foreground)" }}
              >
                {address}
              </dd>
            </div>
          )}

          {hours && (
            <div className="flex flex-col gap-1">
              <dt
                className="text-sm font-semibold uppercase tracking-widest"
                style={{ color: "var(--color-primary-foreground)", opacity: 0.75 }}
              >
                Графік роботи
              </dt>
              <dd
                className="text-xl"
                style={{ color: "var(--color-primary-foreground)" }}
              >
                {hours}
              </dd>
            </div>
          )}

          {email && (
            <div className="flex flex-col gap-1">
              <dt
                className="text-sm font-semibold uppercase tracking-widest"
                style={{ color: "var(--color-primary-foreground)", opacity: 0.75 }}
              >
                Email
              </dt>
              <dd
                className="text-xl"
                style={{ color: "var(--color-primary-foreground)" }}
              >
                {email}
              </dd>
            </div>
          )}
        </dl>
      </div>
    </section>
  );
}
