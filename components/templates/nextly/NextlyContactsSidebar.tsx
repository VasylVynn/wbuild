import type { BlockProps } from "@/lib/blocks/schema";
import { telegramHref, viberHref } from "@/lib/blocks/contact-links";

/*
 * Contacts · variant "sidebar" — a structural counterpoint to the base
 * NextlyContacts single centred card. Here an asymmetric two-column band: a
 * left indigo aside carries the heading + the primary call/messenger actions
 * (so the CTA leads, before the facts), while the right column lists the facts
 * as a divided reference table (divide-y rows) instead of the base's 2-col icon
 * grid. Same link behaviour (tel: / viberHref / telegramHref), same
 * clean-indigo tokens, light + dark.
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

export default function NextlyContactsSidebar({ data }: { data: unknown }) {
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
        <a href={`tel:${phone.replace(/\s/g, "")}`} className="text-gray-800 transition-colors hover:text-indigo-600 dark:text-gray-100 dark:hover:text-indigo-400">
          {phone}
        </a>
      ),
    });
  }
  if (address) facts.push({ label: "Адреса", icon: <MapPinIcon />, value: address });
  if (hours) facts.push({ label: "Графік роботи", icon: <ClockIcon />, value: hours });
  if (email) facts.push({ label: "Email", icon: <MailIcon />, value: email });

  return (
    <section className="py-16 lg:py-20" aria-labelledby={title ? "contacts-title" : undefined}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-5 lg:items-stretch">
          {/* Left aside — heading + actions lead the block. */}
          <div className="flex flex-col justify-between rounded-2xl bg-indigo-600 p-8 text-white lg:col-span-2 dark:bg-indigo-700">
            <div>
              <span className="text-xs font-semibold uppercase tracking-widest text-indigo-200">Контакти</span>
              {title && (
                <h2 id="contacts-title" className="mt-3 text-2xl font-bold leading-snug">
                  {title}
                </h2>
              )}
              <p className="mt-3 text-sm text-indigo-100">Оберіть зручний спосіб звʼязку.</p>
            </div>

            {hasButtons && (
              <div className="mt-8 flex flex-col gap-3">
                {phone && (
                  <a
                    href={`tel:${phone.replace(/\s/g, "")}`}
                    className="rounded-md bg-white px-6 py-2.5 text-center text-sm font-semibold text-indigo-600 transition-colors hover:bg-indigo-50"
                  >
                    Подзвонити
                  </a>
                )}
                {viberUrl && (
                  <a
                    href={viberUrl}
                    className="rounded-md border border-white/40 px-6 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-white/10"
                  >
                    Viber
                  </a>
                )}
                {telegramUrl && (
                  <a
                    href={telegramUrl}
                    target="_blank"
                    rel="noopener"
                    className="rounded-md border border-white/40 px-6 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-white/10"
                  >
                    Telegram
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Right column — facts as a divided reference list. */}
          {facts.length > 0 && (
            <div className="rounded-2xl bg-gray-50 p-8 lg:col-span-3 dark:bg-neutral-800">
              <dl className="divide-y divide-gray-200 dark:divide-neutral-700">
                {facts.map((fact, i) => (
                  <div key={i} className="flex items-center gap-4 py-5 first:pt-0 last:pb-0">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-indigo-600 dark:bg-neutral-900 dark:text-indigo-400">
                      {fact.icon}
                    </span>
                    <div className="flex flex-1 flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <dt className="text-xs font-medium uppercase tracking-widest text-gray-500 dark:text-gray-400">{fact.label}</dt>
                      <dd className="text-base text-gray-800 dark:text-gray-100">{fact.value}</dd>
                    </div>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
