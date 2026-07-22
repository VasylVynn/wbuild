import type { BlockProps } from "@/lib/blocks/schema";
import { telegramHref, viberHref } from "@/lib/blocks/contact-links";

/*
 * Contacts · variant "band" — the base React2021Contacts is a centred gray-50
 * card with a 2-col fact grid; this is a full-bleed dark-ink (#1a2e35) band. The
 * facts run as a horizontal wrap row (coral-square icons), and the call /
 * messenger actions sit in a side column. Changes alignment (centred card →
 * full-width band), column axis (2-col grid → inline wrap + side rail) and the
 * decor field. Same tel: / viberHref / telegramHref link behaviour.
 */
function PhoneIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 0 1 2-2h3l2 5-2.5 1.5a11 11 0 0 0 5 5L14 12l5 2v3a2 2 0 0 1-2 2h-1C9.163 19 5 14.837 5 9V8" />
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12Z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m3 7 9 6 9-6" />
    </svg>
  );
}

export default function React2021ContactsBand({ data }: { data: unknown }) {
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
        <a href={`tel:${phone.replace(/\s/g, "")}`} className="text-white transition-colors hover:text-[#ec4755]">
          {phone}
        </a>
      ),
    });
  }
  if (address) facts.push({ label: "Адреса", icon: <MapPinIcon />, value: address });
  if (hours) facts.push({ label: "Графік роботи", icon: <ClockIcon />, value: hours });
  if (email) facts.push({ label: "Email", icon: <MailIcon />, value: email });

  return (
    <section className="bg-[#1a2e35] py-14 md:py-16" aria-labelledby={title ? "contacts-title" : undefined}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            {title && (
              <h2 id="contacts-title" className="text-2xl font-extrabold text-white sm:text-3xl">
                {title}
              </h2>
            )}

            {facts.length > 0 && (
              <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-5">
                {facts.map((fact, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border-4 border-[#ec4755] bg-white text-[#ec4755]">
                      {fact.icon}
                    </span>
                    <div className="flex flex-col gap-0.5">
                      <dt className="text-[11px] font-medium uppercase tracking-widest text-gray-400">{fact.label}</dt>
                      <dd className="text-base text-white">{fact.value}</dd>
                    </div>
                  </div>
                ))}
              </dl>
            )}
          </div>

          {hasButtons && (
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              {phone && (
                <a
                  href={`tel:${phone.replace(/\s/g, "")}`}
                  className="rounded-md bg-[#ec4755] px-6 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-[#a12c34]"
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
      </div>
    </section>
  );
}
