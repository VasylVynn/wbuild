"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Reveal } from "./Reveal";

/**
 * The four objections a non-technical owner actually raises. Answers stay
 * inside what the product really does today — no plan ladder, no promises the
 * funnel cannot keep.
 */
const items = [
  {
    q: "Мені потрібні технічні навички?",
    a: "Зовсім ні. Ви просто відповідаєте на кілька запитань у чаті звичайними словами — решту робить помічник.",
  },
  {
    q: "Як саме заявки потрапляють у Telegram?",
    a: "На кожному сайті є форма для заявок. Щойно клієнт її надсилає — заявка миттєво прилітає у ваш Telegram з імʼям, телефоном і повідомленням.",
  },
  {
    q: "Чи можу я змінити сайт пізніше?",
    a: "Так. У редакторі ви так само пишете у чат: «зроби заголовок коротшим» або «додай послугу» — і сайт оновлюється. Опублікувати зміни можете тільки ви.",
  },
  {
    q: "Скільки це коштує?",
    a: "Створити й опублікувати сайт можна безкоштовно — без карток і без прихованих умов.",
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="mx-auto max-w-3xl scroll-mt-24 px-4 py-16 sm:px-6 sm:py-24">
      <Reveal className="text-center">
        <span className="text-[14px] font-bold text-honey-text">Питання</span>
        <h2 className="mt-2 text-balance font-brand text-[28px] font-semibold leading-tight tracking-tight sm:text-[36px]">
          Часті запитання
        </h2>
      </Reveal>

      <div className="mt-10 flex flex-col gap-3">
        {items.map((item, i) => {
          const isOpen = open === i;
          return (
            <Reveal key={item.q} delay={i * 70}>
              <div className="overflow-hidden rounded-2xl border border-line bg-surface">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                  aria-expanded={isOpen}
                  aria-controls={`faq-panel-${i}`}
                >
                  <span className="text-[16px] font-semibold text-ink">{item.q}</span>
                  <span
                    aria-hidden
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-transform duration-300 ${
                      isOpen ? "rotate-45 bg-honey text-honey-text" : "bg-sunken text-ink"
                    }`}
                  >
                    <Plus size={16} />
                  </span>
                </button>
                <div
                  id={`faq-panel-${i}`}
                  aria-hidden={!isOpen}
                  inert={!isOpen}
                  className={`grid transition-all duration-300 ease-out ${
                    isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="overflow-hidden">
                    <p className="px-5 pb-5 text-[15px] leading-relaxed text-ink-muted">{item.a}</p>
                  </div>
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
