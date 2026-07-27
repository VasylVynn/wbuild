import { Leaf, MessageCircle, PenLine, Lightbulb } from "lucide-react";
import { Reveal } from "./Reveal";

/**
 * What the owner actually gets. This slot carries the product's real claims —
 * the site is free to build and publish, so there is no plan ladder here.
 */
const features = [
  {
    icon: Leaf,
    title: "Сайт, що викликає довіру",
    text: "Охайний, теплий і сучасний — такий, що клієнту хочеться залишитись і написати вам.",
  },
  {
    icon: MessageCircle,
    title: "Заявки в Telegram",
    text: "Ніяких пропущених листів і незручних форм — усі звернення падають прямо у ваш чат.",
    accent: true,
  },
  {
    icon: PenLine,
    title: "Простий редактор — жодних конструкторів",
    text: "Змінити текст чи ціну можна за хвилину, з телефону. Без блоків, сіток і налаштувань.",
  },
  {
    icon: Lightbulb,
    title: "Помічник, який радить, що написати",
    text: "Не знаєте, як описати послугу? Помічник підкаже слова, які працюють на клієнта.",
  },
];

const verticals = [
  { emoji: "💐", label: "Квіткарня" },
  { emoji: "🥐", label: "Пекарня" },
  { emoji: "⚖️", label: "Юрист" },
  { emoji: "🔧", label: "Автосервіс" },
  { emoji: "💅", label: "Салон краси" },
];

export function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16 sm:px-6 sm:py-24">
      <Reveal className="mx-auto max-w-2xl text-center">
        <span className="text-[14px] font-bold text-honey-text">Усе включено</span>
        <h2 className="mt-2 text-balance font-brand text-[28px] font-semibold leading-tight tracking-tight sm:text-[36px]">
          Що ви отримуєте
        </h2>
        <p className="mt-3 text-[16px] text-ink-muted">
          Створити й опублікувати сайт можна безкоштовно — без карток і технічних знань.
        </p>
      </Reveal>

      <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2">
        {features.map((feature, i) => (
          <Reveal key={feature.title} delay={i * 100}>
            <div
              className={`flex h-full flex-col rounded-3xl border p-6 shadow-card transition-all hover:-translate-y-1 hover:shadow-lg sm:p-7 ${
                feature.accent ? "border-transparent bg-honey-soft" : "border-line bg-surface"
              }`}
            >
              <span
                className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                  feature.accent ? "bg-honey text-honey-text" : "bg-sunken text-ink-muted"
                }`}
              >
                <feature.icon size={22} />
              </span>
              <h3 className="mt-5 text-[19px] font-bold leading-snug text-ink">{feature.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">{feature.text}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal delay={120} className="mt-12">
        <p className="text-center text-[15px] font-semibold text-ink-muted">
          Для будь-якої справи, яка чекає на клієнтів
        </p>
        <ul className="mt-5 flex flex-wrap justify-center gap-3">
          {verticals.map((vertical) => (
            <li
              key={vertical.label}
              className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface px-4 py-2.5 text-[15px] font-semibold text-ink"
            >
              <span aria-hidden>{vertical.emoji}</span>
              {vertical.label}
            </li>
          ))}
          <li className="inline-flex items-center gap-2 rounded-full bg-honey-soft px-4 py-2.5 text-[15px] font-bold text-honey-text">
            <span aria-hidden>✦</span>
            Будь-яка справа
          </li>
        </ul>
      </Reveal>
    </section>
  );
}
