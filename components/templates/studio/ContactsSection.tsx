"use client";

import { motion } from "framer-motion";
import type { BlockProps } from "@/lib/blocks/schema";
import { telegramHref, viberHref } from "@/lib/blocks/contact-links";

/*
 * Contacts — NO source equivalent. The link BEHAVIOUR is copied from
 * components/blocks/Contacts.tsx: a tel: link on the phone, and the
 * viberHref/telegramHref normalisation helpers for the messenger buttons.
 * Only the styling is the template's: a bordered dark `.card` holding the
 * contact facts (phone/address/hours/email) and a `.btn-gradient` call button
 * next to `.btn-ghost` messenger buttons.
 */
export default function ContactsSection({ data }: { data: unknown }) {
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
        <a href={`tel:${phone.replace(/\s/g, "")}`} className="text-white hover:text-[var(--color-accent)] transition-colors">
          {phone}
        </a>
      ),
    });
  }
  if (address) facts.push({ label: "Адреса", value: address });
  if (hours) facts.push({ label: "Графік роботи", value: hours });
  if (email) facts.push({ label: "Email", value: email });

  return (
    <section className="py-20 md:py-28" aria-labelledby={title ? "contacts-title" : undefined}>
      <div className="container mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="card max-w-3xl mx-auto"
        >
          {title && <h2 id="contacts-title" className="section-title mb-8">{title}</h2>}

          {facts.length > 0 && (
            <dl className="grid gap-6 sm:grid-cols-2">
              {facts.map((fact, i) => (
                <div key={i} className="flex flex-col gap-1">
                  <dt className="text-xs font-medium uppercase tracking-widest text-zinc-500">{fact.label}</dt>
                  <dd className="text-base text-zinc-300">{fact.value}</dd>
                </div>
              ))}
            </dl>
          )}

          {hasButtons && (
            <div className="mt-8 flex flex-col sm:flex-row flex-wrap gap-3">
              {phone && (
                <a href={`tel:${phone.replace(/\s/g, "")}`} className="btn-gradient">
                  Подзвонити
                </a>
              )}
              {viberUrl && (
                <a href={viberUrl} className="btn-ghost">
                  Viber
                </a>
              )}
              {telegramUrl && (
                <a href={telegramUrl} target="_blank" rel="noopener" className="btn-ghost">
                  Telegram
                </a>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
}
