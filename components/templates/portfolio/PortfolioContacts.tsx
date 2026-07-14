import type { BlockProps } from "@/lib/blocks/schema";
import { telegramHref, viberHref } from "@/lib/blocks/contact-links";

/*
 * Contacts — NO source equivalent. The link BEHAVIOUR is copied from
 * components/blocks/Contacts.tsx (via components/templates/studio/ContactsSection.tsx):
 * a tel: link on the phone, and the viberHref/telegramHref normalisation
 * helpers for the messenger buttons. Only the styling is the portfolio's:
 * a glowing glass card holding the contact facts behind small teal icons,
 * a solid pill call button, and outline pill messenger buttons.
 */
export default function PortfolioContacts({ data }: { data: unknown }) {
  const d = data as BlockProps["contacts"];
  const { title, phone, address, hours, email, viber, telegram } = d;

  const viberUrl = viberHref(viber);
  const telegramUrl = telegramHref(telegram);
  const hasButtons = Boolean(phone || viberUrl || telegramUrl);

  const facts: { label: string; value: React.ReactNode; icon: React.ReactNode }[] = [];
  if (phone) {
    facts.push({
      label: "Телефон",
      value: (
        <a href={`tel:${phone.replace(/\s/g, "")}`} className="hover:text-primary transition-colors">
          {phone}
        </a>
      ),
      icon: <PhoneIcon />,
    });
  }
  if (address) facts.push({ label: "Адреса", value: address, icon: <MapPinIcon /> });
  if (hours) facts.push({ label: "Графік роботи", value: hours, icon: <ClockIcon /> });
  if (email) {
    facts.push({
      label: "Email",
      value: (
        <a href={`mailto:${email}`} className="hover:text-primary transition-colors">
          {email}
        </a>
      ),
      icon: <MailIcon />,
    });
  }

  return (
    <section className="py-16 md:py-24" aria-labelledby={title ? "contacts-title" : undefined}>
      <div className="container mx-auto px-4 sm:px-6">
        <div className="glass rounded-3xl p-8 max-w-3xl mx-auto animate-fade-in">
          {title && (
            <h2 id="contacts-title" className="text-2xl md:text-3xl font-semibold glow-text mb-8">
              {title}
            </h2>
          )}

          {facts.length > 0 && (
            <dl className="grid gap-6 sm:grid-cols-2">
              {facts.map((fact, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    {fact.icon}
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                      {fact.label}
                    </dt>
                    <dd className="text-base text-foreground">{fact.value}</dd>
                  </div>
                </div>
              ))}
            </dl>
          )}

          {hasButtons && (
            <div className="mt-8 flex flex-col sm:flex-row flex-wrap gap-3">
              {phone && (
                <a
                  href={`tel:${phone.replace(/\s/g, "")}`}
                  className="rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 px-6 py-3 text-sm font-medium text-center"
                >
                  Подзвонити
                </a>
              )}
              {viberUrl && (
                <a
                  href={viberUrl}
                  className="rounded-full border border-border px-6 py-3 text-sm font-medium text-center hover:border-primary hover:text-primary transition-colors"
                >
                  Viber
                </a>
              )}
              {telegramUrl && (
                <a
                  href={telegramUrl}
                  target="_blank"
                  rel="noopener"
                  className="rounded-full border border-border px-6 py-3 text-sm font-medium text-center hover:border-primary hover:text-primary transition-colors"
                >
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

function PhoneIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 0 1 2-2h2.28a1 1 0 0 1 .97.76l.7 2.8a1 1 0 0 1-.27.95l-1.5 1.5a13 13 0 0 0 6.28 6.28l1.5-1.5a1 1 0 0 1 .95-.27l2.8.7a1 1 0 0 1 .76.97V19a2 2 0 0 1-2 2h-1C9.4 21 3 14.6 3 6.5V5Z" />
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s-7-6.1-7-11.5A7 7 0 0 1 19 9.5C19 14.9 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3.5 2" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m4 7 8 6 8-6" />
    </svg>
  );
}
