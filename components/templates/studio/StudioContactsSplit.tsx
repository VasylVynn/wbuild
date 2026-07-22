"use client";

import type { BlockProps } from "@/lib/blocks/schema";
import { telegramHref, viberHref } from "@/lib/blocks/contact-links";
import { Reveal } from "../shared/reveal";

/*
 * Contacts — `split` variant. Same contact facts + messenger behaviour as
 * ContactsSection (tel: link, viberHref/telegramHref helpers), restructured
 * from one centred card into an asymmetric two-column split: a left info
 * sidebar lists the facts as a stacked register, a right accent decor panel
 * (radial mesh, no image — §4.8) gathers the call/messenger buttons as large
 * stacked targets. Column axis, alignment and button order all differ.
 */
export default function StudioContactsSplit({ data }: { data: unknown }) {
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
          className="text-white transition-colors hover:text-[var(--color-accent)]"
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
    <section className="py-12 md:py-16" aria-labelledby={title ? "contacts-title" : undefined}>
      <div className="container mx-auto px-4 sm:px-6">
        <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-[1fr_0.85fr] md:gap-5">
          {/* Info sidebar */}
          <Reveal margin="-80px" className="flex flex-col justify-center">
            {title && (
              <h2 id="contacts-title" className="section-title mb-8">
                {title}
              </h2>
            )}
            {facts.length > 0 && (
              <dl className="flex flex-col">
                {facts.map((fact, i) => (
                  <div
                    key={i}
                    className="flex flex-col gap-1 border-t border-[var(--color-border)] py-4 first:border-t-0 first:pt-0"
                  >
                    <dt className="text-xs font-medium uppercase tracking-widest text-zinc-500">{fact.label}</dt>
                    <dd className="text-base text-zinc-300">{fact.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </Reveal>

          {/* Accent decor panel with the actions */}
          <Reveal
            margin="-80px"
            delay={0.1}
            className="card gradient-border relative flex flex-col justify-center overflow-hidden"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-70"
              style={{ background: "radial-gradient(ellipse at 70% 20%, rgba(139,92,246,0.25), transparent 60%)" }}
            />
            <div className="relative">
              <p className="mb-6 text-sm leading-relaxed text-zinc-400">
                Оберіть зручний спосіб звʼязку — відповімо якнайшвидше.
              </p>
              {hasButtons ? (
                <div className="flex flex-col gap-3">
                  {phone && (
                    <a href={`tel:${phone.replace(/\s/g, "")}`} className="btn-gradient w-full">
                      Подзвонити
                    </a>
                  )}
                  {viberUrl && (
                    <a href={viberUrl} className="btn-ghost w-full">
                      Viber
                    </a>
                  )}
                  {telegramUrl && (
                    <a href={telegramUrl} target="_blank" rel="noopener" className="btn-ghost w-full">
                      Telegram
                    </a>
                  )}
                </div>
              ) : (
                <p className="text-sm text-zinc-500">Зателефонуйте або напишіть нам зручним способом.</p>
              )}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
