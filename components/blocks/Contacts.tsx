import type { BlockProps } from "@/lib/blocks/schema";
import { telegramHref, viberHref } from "@/lib/blocks/contact-links";

export default function Contacts({ data }: { data: BlockProps["contacts"] }) {
  const { title, phone, address, hours, email, viber, telegram } = data;

  const viberUrl = viberHref(viber);
  const telegramUrl = telegramHref(telegram);
  const hasButtons = Boolean(phone || viberUrl || telegramUrl);

  const buttonClass =
    "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-6 py-3 text-lg font-semibold";
  const buttonStyle = {
    backgroundColor: "var(--color-primary-foreground)",
    color: "var(--color-primary)",
  };

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

        {hasButtons && (
          <div className="mt-10 flex flex-col flex-wrap gap-4 sm:flex-row">
            {phone && (
              <a href={`tel:${phone.replace(/\s/g, "")}`} className={buttonClass} style={buttonStyle}>
                Подзвонити
              </a>
            )}
            {viberUrl && (
              <a href={viberUrl} className={buttonClass} style={buttonStyle}>
                Viber
              </a>
            )}
            {telegramUrl && (
              <a
                href={telegramUrl}
                target="_blank"
                rel="noopener"
                className={buttonClass}
                style={buttonStyle}
              >
                Telegram
              </a>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
