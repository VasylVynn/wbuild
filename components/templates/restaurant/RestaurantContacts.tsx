import type { BlockProps } from "@/lib/blocks/schema";
import { telegramHref, viberHref } from "@/lib/blocks/contact-links";

/*
 * Contacts — ported from components/templates/aisaas/AiSaasContacts.tsx. The
 * link BEHAVIOUR is copied verbatim (tel: link on the phone, viberHref/
 * telegramHref normalisation for the messenger buttons). Same field usage
 * (title?, phone?, address?, hours?, viber?, telegram?, email? + messenger
 * buttons). Restyled to the warm hospitality system: a sand card, small
 * terracotta icon chips — and, since opening hours matter most for a
 * restaurant, `hours` gets its own prominent gold-bordered callout above the
 * regular fact grid instead of being just another line item.
 */
function PhoneIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 0 1 2-2h3l2 5-2.5 1.5a11 11 0 0 0 5 5L14 12l5 2v3a2 2 0 0 1-2 2h-1C9.163 19 5 14.837 5 9V8" />
    </svg>
  );
}

function MapPinIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12Z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}

function ClockIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3" />
    </svg>
  );
}

function MailIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m3 7 9 6 9-6" />
    </svg>
  );
}

export default function RestaurantContacts({ data }: { data: unknown }) {
  const d = data as BlockProps["contacts"];
  const { title, phone, address, hours, email, viber, telegram } = d;

  const viberUrl = viberHref(viber);
  const telegramUrl = telegramHref(telegram);
  const hasButtons = Boolean(phone || viberUrl || telegramUrl);

  // `hours` is deliberately EXCLUDED from this generic grid — it gets its own
  // prominent callout below instead of being one fact among equals.
  const facts: { label: string; icon: React.ReactNode; value: React.ReactNode }[] = [];
  if (phone) {
    facts.push({
      label: "Телефон",
      icon: <PhoneIcon />,
      value: (
        <a href={`tel:${phone.replace(/\s/g, "")}`} className="text-[#2A2018] transition-colors hover:text-[#C0562F]">
          {phone}
        </a>
      ),
    });
  }
  if (address) facts.push({ label: "Адреса", icon: <MapPinIcon />, value: address });
  if (email) facts.push({ label: "Email", icon: <MailIcon />, value: email });

  return (
    <section className="bg-[#FBF6EF] py-12 md:py-16" aria-labelledby={title ? "contacts-title" : undefined}>
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl rounded-3xl bg-[#F3EADD] p-8">
          {title && (
            <h2 id="contacts-title" className="mb-8 text-2xl font-bold text-[#2A2018]">
              {title}
            </h2>
          )}

          {hours && (
            <div className="mb-8 flex items-center gap-4 rounded-2xl border border-[#B7791F]/30 bg-white px-5 py-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#B7791F]/10 text-[#B7791F]">
                <ClockIcon className="h-6 w-6" />
              </span>
              <div className="flex flex-col gap-0.5">
                <p className="text-xs font-semibold uppercase tracking-widest text-[#B7791F]">Графік роботи</p>
                <p className="text-lg font-semibold text-[#2A2018]">{hours}</p>
              </div>
            </div>
          )}

          {facts.length > 0 && (
            <dl className="grid gap-6 sm:grid-cols-2">
              {facts.map((fact, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#C0562F]">
                    {fact.icon}
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-xs font-medium uppercase tracking-widest text-[#6F6257]">{fact.label}</dt>
                    <dd className="text-base text-[#2A2018]">{fact.value}</dd>
                  </div>
                </div>
              ))}
            </dl>
          )}

          {hasButtons && (
            <div className="mt-8 flex flex-col flex-wrap gap-3 sm:flex-row">
              {phone && (
                <a
                  href={`tel:${phone.replace(/\s/g, "")}`}
                  className="rounded-full bg-[#C0562F] px-6 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-[#9E4423]"
                >
                  Подзвонити
                </a>
              )}
              {viberUrl && (
                <a
                  href={viberUrl}
                  className="rounded-full border border-[#E0D3C0] bg-white px-6 py-2.5 text-center text-sm font-semibold text-[#2A2018] transition-colors hover:border-[#C0562F]"
                >
                  Viber
                </a>
              )}
              {telegramUrl && (
                <a
                  href={telegramUrl}
                  target="_blank"
                  rel="noopener"
                  className="rounded-full border border-[#E0D3C0] bg-white px-6 py-2.5 text-center text-sm font-semibold text-[#2A2018] transition-colors hover:border-[#C0562F]"
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

/*
 * Variant "sidebar" — a reference-desk layout rather than the base's single
 * centered card. A two-column band whose wide left column lists the contact
 * facts as a hairline-divided vertical index, while a right sidebar aside pins
 * the opening HOURS in a gold-bordered callout with the messenger buttons
 * stacked beneath. Reorders the base (hours + buttons leave the main flow into
 * the aside) and swaps the 2-col fact grid for a single divided column.
 */
export function RestaurantContactsSidebar({ data }: { data: unknown }) {
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
        <a href={`tel:${phone.replace(/\s/g, "")}`} className="text-[#2A2018] transition-colors hover:text-[#C0562F]">
          {phone}
        </a>
      ),
    });
  }
  if (address) facts.push({ label: "Адреса", icon: <MapPinIcon />, value: address });
  if (email) facts.push({ label: "Email", icon: <MailIcon />, value: email });

  return (
    <section className="bg-[#FBF6EF] py-12 md:py-16" aria-labelledby={title ? "contacts-sidebar-title" : undefined}>
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {title && (
              <h2 id="contacts-sidebar-title" className="mb-6 font-serif text-2xl font-bold text-[#2A2018] md:text-3xl">
                {title}
              </h2>
            )}
            {facts.length > 0 && (
              <dl className="divide-y divide-[#E0D3C0]">
                {facts.map((fact, i) => (
                  <div key={i} className="flex items-start gap-3 py-4 first:pt-0">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F3EADD] text-[#C0562F]">
                      {fact.icon}
                    </span>
                    <div className="flex flex-col gap-0.5">
                      <dt className="text-xs font-medium uppercase tracking-widest text-[#6F6257]">{fact.label}</dt>
                      <dd className="text-base text-[#2A2018]">{fact.value}</dd>
                    </div>
                  </div>
                ))}
              </dl>
            )}
          </div>

          <aside className="flex flex-col gap-4">
            {hours && (
              <div className="rounded-2xl border border-[#B7791F]/30 bg-[#F3EADD] p-5">
                <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#B7791F]/10 text-[#B7791F]">
                  <ClockIcon className="h-6 w-6" />
                </span>
                <p className="text-xs font-semibold uppercase tracking-widest text-[#B7791F]">Графік роботи</p>
                <p className="mt-1 text-lg font-semibold text-[#2A2018]">{hours}</p>
              </div>
            )}
            {hasButtons && (
              <div className="flex flex-col gap-3">
                {phone && (
                  <a
                    href={`tel:${phone.replace(/\s/g, "")}`}
                    className="rounded-full bg-[#C0562F] px-6 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-[#9E4423]"
                  >
                    Подзвонити
                  </a>
                )}
                {viberUrl && (
                  <a
                    href={viberUrl}
                    className="rounded-full border border-[#E0D3C0] bg-white px-6 py-2.5 text-center text-sm font-semibold text-[#2A2018] transition-colors hover:border-[#C0562F]"
                  >
                    Viber
                  </a>
                )}
                {telegramUrl && (
                  <a
                    href={telegramUrl}
                    target="_blank"
                    rel="noopener"
                    className="rounded-full border border-[#E0D3C0] bg-white px-6 py-2.5 text-center text-sm font-semibold text-[#2A2018] transition-colors hover:border-[#C0562F]"
                  >
                    Telegram
                  </a>
                )}
              </div>
            )}
          </aside>
        </div>
      </div>
    </section>
  );
}
