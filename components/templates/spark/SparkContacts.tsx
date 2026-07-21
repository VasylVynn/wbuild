import type { BlockProps } from "@/lib/blocks/schema";
import { telegramHref, viberHref } from "@/lib/blocks/contact-links";

/*
 * Contacts — the funnel's textual counterpart. Link behaviour matches the other
 * templates (tel: on the phone, viberHref/telegramHref normalisation for the
 * messenger buttons). Same field usage (title?, phone?, address?, hours?, email?,
 * viber?, telegram?). Clean spark styling: a hairline card, mono field labels, a
 * solid «Подзвонити» primary and outline messenger buttons.
 */
function PhoneIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 0 1 2-2h3l2 5-2.5 1.5a11 11 0 0 0 5 5L14 12l5 2v3a2 2 0 0 1-2 2h-1C9.163 19 5 14.837 5 9V8" />
    </svg>
  );
}
function MapPinIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12Z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}
function ClockIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3" />
    </svg>
  );
}
function MailIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m3 7 9 6 9-6" />
    </svg>
  );
}

export default function SparkContacts({ data }: { data: unknown }) {
  const d = data as BlockProps["contacts"];
  const { title, phone, address, hours, email, viber, telegram } = d;

  const viberUrl = viberHref(viber);
  const telegramUrl = telegramHref(telegram);
  const hasButtons = Boolean(phone || viberUrl || telegramUrl);

  const facts: { label: string; icon: React.ReactNode; value: React.ReactNode }[] = [];
  if (phone) {
    facts.push({
      label: "Телефон",
      icon: <PhoneIcon />,
      value: (
        <a href={`tel:${phone.replace(/\s/g, "")}`} className="transition-colors hover:text-[var(--spark-muted-fg)]">
          {phone}
        </a>
      ),
    });
  }
  if (address) facts.push({ label: "Адреса", icon: <MapPinIcon />, value: address });
  if (hours) facts.push({ label: "Графік", icon: <ClockIcon />, value: hours });
  if (email) facts.push({ label: "Email", icon: <MailIcon />, value: email });

  return (
    <section id="contacts" className="bg-[var(--spark-bg)] px-4 py-16 sm:px-6 md:py-24" aria-labelledby={title ? "spark-contacts-title" : undefined}>
      <div className="mx-auto max-w-3xl">
        <div className="spark-card p-8 md:p-10">
          {title && (
            <h2 id="spark-contacts-title" className="mb-8 text-2xl text-[var(--spark-fg)] md:text-3xl">
              {title}
            </h2>
          )}

          {facts.length > 0 && (
            <dl className="grid gap-6 sm:grid-cols-2">
              {facts.map((fact, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--spark-border)] bg-[var(--spark-muted)] text-[var(--spark-fg)]">
                    {fact.icon}
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <dt className="spark-mono text-xs uppercase tracking-wide text-[var(--spark-muted-fg)]">{fact.label}</dt>
                    <dd className="text-base text-[var(--spark-fg)]">{fact.value}</dd>
                  </div>
                </div>
              ))}
            </dl>
          )}

          {hasButtons && (
            <div className="mt-8 flex flex-col flex-wrap gap-3 sm:flex-row">
              {phone && (
                <a href={`tel:${phone.replace(/\s/g, "")}`} className="spark-btn spark-btn-primary">
                  Подзвонити
                </a>
              )}
              {viberUrl && (
                <a href={viberUrl} className="spark-btn spark-btn-outline">
                  Viber
                </a>
              )}
              {telegramUrl && (
                <a href={telegramUrl} target="_blank" rel="noopener" className="spark-btn spark-btn-outline">
                  Telegram
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
