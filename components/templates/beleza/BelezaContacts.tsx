import type { BlockProps } from "@/lib/blocks/schema";
import { telegramHref, viberHref } from "@/lib/blocks/contact-links";
import { ClockIcon, MailIcon, MapPinIcon, PhoneIcon } from "./icons";

/*
 * Contacts — link behaviour mirrors the restaurant/aisaas contract (tel: on the
 * phone, viberHref/telegramHref normalisation for the messenger buttons). Same
 * field usage (title?, phone?, address?, hours?, email?, viber?, telegram?).
 * Restyled to the beleza system: a soft white card, rose icon chips and a
 * prominent «Графік роботи» callout above the fact grid. Server component.
 */
type ContactsData = BlockProps["contacts"];

export default function BelezaContacts({ data }: { data: unknown }) {
  const d = data as ContactsData;
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
        <a href={`tel:${phone.replace(/\s/g, "")}`} className="transition-colors hover:text-[color:var(--beleza-branding)]">
          {phone}
        </a>
      ),
    });
  }
  if (address) facts.push({ label: "Адреса", icon: <MapPinIcon />, value: address });
  if (email) facts.push({ label: "Email", icon: <MailIcon />, value: email });

  return (
    <section id="contacts" className="beleza-section" aria-labelledby={title ? "beleza-contacts-title" : undefined}>
      <div className="beleza-container max-w-3xl">
        <div className="beleza-card !p-8">
          {title && (
            <h2 id="beleza-contacts-title" className="beleza-ink mb-8 text-2xl font-bold">
              {title}
            </h2>
          )}

          {hours && (
            <div className="mb-8 flex items-center gap-4 rounded-2xl px-5 py-4" style={{ background: "var(--beleza-brand-1)" }}>
              <span className="beleza-chip !h-12 !w-12 !rounded-full">
                <ClockIcon className="h-6 w-6" />
              </span>
              <div className="flex flex-col gap-0.5">
                <p className="beleza-accent text-xs font-semibold uppercase tracking-widest">Графік роботи</p>
                <p className="beleza-ink text-lg font-semibold">{hours}</p>
              </div>
            </div>
          )}

          {facts.length > 0 && (
            <dl className="grid gap-6 sm:grid-cols-2">
              {facts.map((fact, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="beleza-chip mt-0.5 !h-9 !w-9 shrink-0">{fact.icon}</span>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <dt className="beleza-muted text-xs font-medium uppercase tracking-widest">{fact.label}</dt>
                    <dd className="beleza-ink text-base">{fact.value}</dd>
                  </div>
                </div>
              ))}
            </dl>
          )}

          {hasButtons && (
            <div className="mt-8 flex flex-col flex-wrap gap-3 sm:flex-row">
              {phone && (
                <a href={`tel:${phone.replace(/\s/g, "")}`} className="beleza-btn">
                  Подзвонити
                </a>
              )}
              {viberUrl && (
                <a href={viberUrl} className="beleza-btn beleza-btn--ghost">
                  Viber
                </a>
              )}
              {telegramUrl && (
                <a href={telegramUrl} target="_blank" rel="noopener" className="beleza-btn beleza-btn--ghost">
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

/*
 * `band` variant — a full-width rose-tinted band with NO card container, laid
 * out as three horizontal columns: the «Графік роботи» callout + title, the
 * facts as a stacked list, and the messenger buttons as their own vertical
 * column. Structurally distinct from the base centred card: band-vs-card
 * density, a three-column horizontal axis and reordered groups.
 */
export function BelezaContactsBand({ data }: { data: unknown }) {
  const d = data as ContactsData;
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
        <a href={`tel:${phone.replace(/\s/g, "")}`} className="transition-colors hover:text-[color:var(--beleza-branding)]">
          {phone}
        </a>
      ),
    });
  }
  if (address) facts.push({ label: "Адреса", icon: <MapPinIcon />, value: address });
  if (email) facts.push({ label: "Email", icon: <MailIcon />, value: email });

  return (
    <section id="contacts" className="beleza-section beleza-tint" aria-labelledby={title ? "beleza-contacts-title" : undefined}>
      <div className="beleza-container">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-center lg:gap-10">
          <div className="lg:col-span-5">
            {title && (
              <h2 id="beleza-contacts-title" className="beleza-ink text-2xl font-bold sm:text-3xl">
                {title}
              </h2>
            )}
            {hours && (
              <div className="mt-6 flex items-center gap-4 rounded-2xl bg-[color:var(--beleza-card)] px-5 py-4">
                <span className="beleza-chip !h-12 !w-12 !rounded-full">
                  <ClockIcon className="h-6 w-6" />
                </span>
                <div className="flex flex-col gap-0.5">
                  <p className="beleza-accent text-xs font-semibold uppercase tracking-widest">Графік роботи</p>
                  <p className="beleza-ink text-lg font-semibold">{hours}</p>
                </div>
              </div>
            )}
          </div>

          {facts.length > 0 && (
            <dl className="flex flex-col gap-5 lg:col-span-4">
              {facts.map((fact, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="beleza-chip mt-0.5 !h-9 !w-9 shrink-0">{fact.icon}</span>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <dt className="beleza-muted text-xs font-medium uppercase tracking-widest">{fact.label}</dt>
                    <dd className="beleza-ink text-base">{fact.value}</dd>
                  </div>
                </div>
              ))}
            </dl>
          )}

          {hasButtons && (
            <div className="flex flex-col gap-3 lg:col-span-3">
              {phone && (
                <a href={`tel:${phone.replace(/\s/g, "")}`} className="beleza-btn beleza-btn--block">
                  Подзвонити
                </a>
              )}
              {viberUrl && (
                <a href={viberUrl} className="beleza-btn beleza-btn--ghost beleza-btn--block">
                  Viber
                </a>
              )}
              {telegramUrl && (
                <a href={telegramUrl} target="_blank" rel="noopener" className="beleza-btn beleza-btn--ghost beleza-btn--block">
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
