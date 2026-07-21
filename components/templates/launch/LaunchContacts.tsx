import type { BlockProps } from "@/lib/blocks/schema";
import { instagramHref, telegramHref, viberHref } from "@/lib/blocks/contact-links";

/*
 * Contacts — textual facts (phone/address/hours/email) in a glass card plus
 * one-tap messenger buttons. Link behaviour mirrors the other templates: tel:
 * on the phone, viberHref/telegramHref/instagramHref normalisation (a messenger
 * button renders only when its handle resolves — no dead links). Facts come
 * only from props (§5 grounding).
 */
function Icon({ path, className = "h-4 w-4" }: { path: React.ReactNode; className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {path}
    </svg>
  );
}

const phonePath = <path d="M5 3h3l2 5-2.5 1.5a11 11 0 0 0 5 5L14 12l5 2v3a2 2 0 0 1-2 2C9.8 19 5 14.2 5 6a2 2 0 0 1 0-3z" />;
const pinPath = (
  <>
    <path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12Z" />
    <circle cx="12" cy="9" r="2.5" />
  </>
);
const clockPath = (
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 3" />
  </>
);
const mailPath = (
  <>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </>
);

export default function LaunchContacts({ data }: { data: unknown }) {
  const d = data as BlockProps["contacts"];
  const { title, phone, address, hours, email, viber, telegram, instagram } = d;

  const viberUrl = viberHref(viber);
  const telegramUrl = telegramHref(telegram);
  const instagramUrl = instagramHref(instagram);
  const hasButtons = Boolean(phone || viberUrl || telegramUrl || instagramUrl);

  const facts: { label: string; icon: React.ReactNode; value: React.ReactNode }[] = [];
  if (phone) {
    facts.push({
      label: "Телефон",
      icon: <Icon path={phonePath} />,
      value: (
        <a href={`tel:${phone.replace(/\s/g, "")}`} className="text-[var(--launch-fg)] transition-colors hover:text-[var(--launch-brand)]">
          {phone}
        </a>
      ),
    });
  }
  if (address) facts.push({ label: "Адреса", icon: <Icon path={pinPath} />, value: address });
  if (hours) facts.push({ label: "Графік", icon: <Icon path={clockPath} />, value: hours });
  if (email) facts.push({ label: "Email", icon: <Icon path={mailPath} />, value: email });

  return (
    <section className="relative px-4 py-20 sm:px-6 md:py-24" aria-labelledby={title ? "contacts-title" : undefined}>
      <div className="mx-auto max-w-4xl">
        <div className="launch-glass rounded-3xl p-8 sm:p-10">
          {title && (
            <h2 id="contacts-title" className="mb-8 text-2xl font-bold text-[var(--launch-fg)] sm:text-3xl">
              {title}
            </h2>
          )}

          {facts.length > 0 && (
            <dl className="grid gap-6 sm:grid-cols-2">
              {facts.map((fact, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--launch-border)] bg-[var(--launch-input)] text-[var(--launch-brand)]">
                    {fact.icon}
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-xs font-medium uppercase tracking-widest text-[var(--launch-muted)]">{fact.label}</dt>
                    <dd className="text-base text-[var(--launch-fg)]">{fact.value}</dd>
                  </div>
                </div>
              ))}
            </dl>
          )}

          {hasButtons && (
            <div className="mt-8 flex flex-col flex-wrap gap-3 sm:flex-row">
              {phone && (
                <a href={`tel:${phone.replace(/\s/g, "")}`} className="launch-btn launch-btn--primary">
                  Подзвонити
                </a>
              )}
              {viberUrl && (
                <a href={viberUrl} className="launch-btn launch-btn--outline">
                  Viber
                </a>
              )}
              {telegramUrl && (
                <a href={telegramUrl} target="_blank" rel="noopener" className="launch-btn launch-btn--outline">
                  Telegram
                </a>
              )}
              {instagramUrl && (
                <a href={instagramUrl} target="_blank" rel="noopener noreferrer" className="launch-btn launch-btn--outline">
                  Instagram
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
