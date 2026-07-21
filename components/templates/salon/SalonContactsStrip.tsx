"use client";

import type { BlockProps } from "@/lib/blocks/schema";
import { telegramHref, viberHref } from "@/lib/blocks/contact-links";
import { ScrollReveal } from "./ScrollReveal";

/*
 * Contacts — `strip` variant. Same facts + messenger behaviour as SalonContacts
 * (tel: link, viberHref/telegramHref helpers), stripped of the large glass panel
 * and icon chips: the facts read as a single minimal inline row divided by
 * hairline rules, with the call/messenger buttons trailing. Density paradigm
 * (large card → slim strip), column axis and alignment all differ from the base.
 */
export default function SalonContactsStrip({ data }: { data: unknown }) {
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
        <a href={`tel:${phone.replace(/\s/g, "")}`} className="text-foreground transition-colors hover:text-accent">
          {phone}
        </a>
      ),
    });
  }
  if (address) facts.push({ label: "Адреса", value: address });
  if (hours) facts.push({ label: "Графік роботи", value: hours });
  if (email) facts.push({ label: "Email", value: email });

  return (
    <section className="relative py-16 sm:py-20 lg:py-24" aria-labelledby={title ? "contacts-title" : undefined}>
      <div className="section-container relative z-10">
        <ScrollReveal>
          <div className="mx-auto max-w-5xl border-y border-border py-8">
            {title && (
              <h2 id="contacts-title" className="font-display text-gradient-gold mb-6 text-2xl font-semibold md:text-3xl">
                {title}
              </h2>
            )}
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              {facts.length > 0 && (
                <dl className="flex flex-wrap items-center gap-x-8 gap-y-4">
                  {facts.map((fact, i) => (
                    <div key={i} className="flex flex-col gap-0.5">
                      <dt className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                        {fact.label}
                      </dt>
                      <dd className="text-base text-foreground/90">{fact.value}</dd>
                    </div>
                  ))}
                </dl>
              )}

              {hasButtons && (
                <div className="flex flex-wrap gap-3 lg:shrink-0">
                  {phone && (
                    <a
                      href={`tel:${phone.replace(/\s/g, "")}`}
                      className="btn-gold-luxe rounded-full px-6 py-3 text-center text-sm font-medium"
                    >
                      Подзвонити
                    </a>
                  )}
                  {viberUrl && (
                    <a
                      href={viberUrl}
                      className="rounded-full border border-border px-6 py-3 text-center text-sm font-medium transition-colors hover:border-accent hover:text-accent"
                    >
                      Viber
                    </a>
                  )}
                  {telegramUrl && (
                    <a
                      href={telegramUrl}
                      target="_blank"
                      rel="noopener"
                      className="rounded-full border border-border px-6 py-3 text-center text-sm font-medium transition-colors hover:border-accent hover:text-accent"
                    >
                      Telegram
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
