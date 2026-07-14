"use client";

import { motion } from "framer-motion";
import type { BlockProps } from "@/lib/blocks/schema";
import { telegramHref, viberHref } from "@/lib/blocks/contact-links";
import { ScrollReveal } from "./ScrollReveal";

/*
 * Contacts — NO source equivalent. The link BEHAVIOUR is copied from
 * studio's ContactsSection (itself lifted from components/blocks/
 * Contacts.tsx): a tel: link on the phone, and the viberHref/telegramHref
 * normalisation helpers for the messenger buttons. Only the styling is
 * salon's: a glass-card panel holding the contact facts (phone/address/
 * hours/email) each with a small gold icon chip, and a btn-gold-luxe call
 * button next to outline pill messenger buttons.
 */
const PhoneIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-4 h-4" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0-.414.336-.75.75-.75h2.086c.361 0 .671.256.738.61l.892 4.673a.75.75 0 01-.336.782l-1.61 1.05a11.25 11.25 0 006.02 6.02l1.05-1.61a.75.75 0 01.782-.336l4.673.892c.354.067.61.377.61.738v2.086a.75.75 0 01-.75.75H18a15.75 15.75 0 01-15.75-15.75V6.75z" />
  </svg>
);
const MapPinIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-4 h-4" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
  </svg>
);
const ClockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-4 h-4" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const MailIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-4 h-4" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0-.414.336-.75.75-.75h18c.414 0 .75.336.75.75v10.5a.75.75 0 01-.75.75h-18a.75.75 0 01-.75-.75V6.75z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7l9 6 9-6" />
  </svg>
);

export default function SalonContacts({ data }: { data: unknown }) {
  const d = data as BlockProps["contacts"];
  const { title, phone, address, hours, email, viber, telegram } = d;

  const viberUrl = viberHref(viber);
  const telegramUrl = telegramHref(telegram);
  const hasButtons = Boolean(phone || viberUrl || telegramUrl);

  const facts: { label: string; value: React.ReactNode; icon: React.ReactNode }[] = [];
  if (phone) {
    facts.push({
      label: "Телефон",
      icon: <PhoneIcon />,
      value: (
        <a href={`tel:${phone.replace(/\s/g, "")}`} className="text-foreground hover:text-accent transition-colors">
          {phone}
        </a>
      ),
    });
  }
  if (address) facts.push({ label: "Адреса", icon: <MapPinIcon />, value: address });
  if (hours) facts.push({ label: "Графік роботи", icon: <ClockIcon />, value: hours });
  if (email) facts.push({ label: "Email", icon: <MailIcon />, value: email });

  return (
    <section className="py-16 sm:py-20 lg:py-24 relative" aria-labelledby={title ? "contacts-title" : undefined}>
      <div className="section-container relative z-10">
        <ScrollReveal>
          <motion.div
            whileHover={{ scale: 1.01 }}
            className="glass-card rounded-3xl p-8 max-w-3xl mx-auto"
          >
            {title && (
              <h2 id="contacts-title" className="font-display text-3xl md:text-4xl font-semibold text-gradient-gold mb-8">
                {title}
              </h2>
            )}

            {facts.length > 0 && (
              <dl className="grid gap-6 sm:grid-cols-2">
                {facts.map((fact, i) => (
                  <div key={i} className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0">
                      {fact.icon}
                    </div>
                    <div className="flex flex-col gap-1">
                      <dt className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{fact.label}</dt>
                      <dd className="text-base text-foreground/90">{fact.value}</dd>
                    </div>
                  </div>
                ))}
              </dl>
            )}

            {hasButtons && (
              <div className="mt-8 flex flex-col sm:flex-row flex-wrap gap-3">
                {phone && (
                  <a href={`tel:${phone.replace(/\s/g, "")}`} className="btn-gold-luxe rounded-full px-6 py-3 text-sm font-medium text-center">
                    Подзвонити
                  </a>
                )}
                {viberUrl && (
                  <a href={viberUrl} className="rounded-full px-6 py-3 text-sm font-medium text-center border border-border hover:border-accent hover:text-accent transition-colors">
                    Viber
                  </a>
                )}
                {telegramUrl && (
                  <a href={telegramUrl} target="_blank" rel="noopener" className="rounded-full px-6 py-3 text-sm font-medium text-center border border-border hover:border-accent hover:text-accent transition-colors">
                    Telegram
                  </a>
                )}
              </div>
            )}
          </motion.div>
        </ScrollReveal>
      </div>
    </section>
  );
}
