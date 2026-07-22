"use client";

import type { BlockProps } from "@/lib/blocks/schema";
import { telegramHref, viberHref } from "@/lib/blocks/contact-links";
import { Reveal } from "./Reveal";

/*
 * Contacts — `band` variant. Same facts + messenger behaviour as FerriContacts
 * (tel: link, viberHref/telegramHref helpers), restructured from a centred
 * bordered card into a full-width navy band framed by thin gold rules: the
 * facts run as a horizontal row of columns (a requisites strip) with the
 * call/messenger buttons trailing. Density paradigm (contained card →
 * full-width band), column axis and alignment all differ from the base.
 */
export default function FerriContactsBand({ data }: { data: unknown }) {
  const d = data as BlockProps["contacts"];
  const { title, phone, address, hours, email, viber, telegram } = d;

  const viberUrl = viberHref(viber);
  const telegramUrl = telegramHref(telegram);
  const hasButtons = Boolean(phone || viberUrl || telegramUrl);

  const facts: { label: string; value: React.ReactNode }[] = [];
  if (phone) {
    facts.push({
      label: "Телефон",
      value: (
        <a
          href={`tel:${phone.replace(/\s/g, "")}`}
          className="text-cream-100 transition-colors hover:text-gold-500"
        >
          {phone}
        </a>
      ),
    });
  }
  if (address) facts.push({ label: "Адреса", value: address });
  if (hours) facts.push({ label: "Графік роботи", value: hours });
  if (email) facts.push({ label: "Email", value: email });

  return (
    <section
      className="border-y border-gold-500/20 bg-navy-900/40 py-14 sm:py-20 lg:py-24"
      aria-labelledby={title ? "contacts-title" : undefined}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          {title && (
            <h2
              id="contacts-title"
              className="mb-10 text-center font-[family-name:var(--ferri-display)] text-2xl font-normal text-cream-100 sm:text-3xl"
            >
              {title}
            </h2>
          )}

          <div className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
            {facts.length > 0 && (
              <dl className="grid flex-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
                {facts.map((fact, i) => (
                  <div key={i} className="flex flex-col gap-2 border-t border-gold-500/20 pt-4">
                    <dt className="text-xs font-medium uppercase tracking-[2px] text-gold-500">{fact.label}</dt>
                    <dd className="text-base text-txt">{fact.value}</dd>
                  </div>
                ))}
              </dl>
            )}

            {hasButtons && (
              <div className="flex flex-col flex-wrap gap-3 sm:flex-row lg:shrink-0">
                {phone && (
                  <a
                    href={`tel:${phone.replace(/\s/g, "")}`}
                    className="bg-gold-500 px-6 py-3 text-center text-[13px] font-medium uppercase tracking-[2px] text-navy-950 transition-all duration-300 hover:bg-gold-400"
                  >
                    Подзвонити
                  </a>
                )}
                {viberUrl && (
                  <a
                    href={viberUrl}
                    className="border border-gold-500/50 px-6 py-3 text-center text-[13px] font-medium uppercase tracking-[2px] text-gold-500 transition-all duration-300 hover:bg-gold-500 hover:text-navy-950"
                  >
                    Viber
                  </a>
                )}
                {telegramUrl && (
                  <a
                    href={telegramUrl}
                    target="_blank"
                    rel="noopener"
                    className="border border-gold-500/50 px-6 py-3 text-center text-[13px] font-medium uppercase tracking-[2px] text-gold-500 transition-all duration-300 hover:bg-gold-500 hover:text-navy-950"
                  >
                    Telegram
                  </a>
                )}
              </div>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
