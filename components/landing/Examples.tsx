import Image from "next/image";
import { Reveal } from "./Reveal";

/**
 * Four shapes a generated site can take. These are illustrations of the output
 * for common verticals (lib/verticals), not customer references — the copy is
 * deliberately «такий сайт збереться», never «ось наші клієнти».
 */
const examples = [
  {
    image: "/landing/flowers.webp",
    category: "Квіткова майстерня",
    name: "Квіти від Олени",
    tagline: "Авторські букети та композиції під кожну подію",
  },
  {
    image: "/landing/bakery.webp",
    category: "Пекарня",
    name: "Тепла Піч",
    tagline: "Хліб на заквасці та десерти, які випікають щоранку",
  },
  {
    image: "/landing/barber.webp",
    category: "Барбершоп",
    name: "Борода & Бритва",
    tagline: "Класичні стрижки й догляд — запис онлайн за хвилину",
  },
  {
    image: "/landing/auto.webp",
    category: "Автосервіс",
    name: "АвтоМайстер",
    tagline: "Чесний ремонт і діагностика без переплат",
  },
];

export function Examples() {
  return (
    <section id="examples" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16 sm:px-6 sm:py-24">
      <Reveal className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div className="max-w-xl">
          <span className="text-[14px] font-bold text-honey-text">Приклади</span>
          <h2 className="mt-2 text-balance font-brand text-[28px] font-semibold leading-tight tracking-tight sm:text-[36px]">
            Які сайти збирає помічник
          </h2>
        </div>
        <p className="max-w-xs text-[15px] text-ink-muted">
          Різні справи — однакова легкість. Оберіть напрям, схожий на ваш.
        </p>
      </Reveal>

      <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2">
        {examples.map((example, i) => (
          <Reveal key={example.name} delay={i * 100}>
            <article className="relative overflow-hidden rounded-3xl border border-line bg-surface shadow-card">
              <div className="relative h-52 overflow-hidden">
                <Image
                  src={example.image}
                  alt={`${example.name} — ${example.category}`}
                  fill
                  sizes="(min-width: 640px) 50vw, 100vw"
                  className="object-cover"
                />
                <div
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"
                />
                <span className="absolute left-4 top-4 rounded-full bg-canvas/90 px-3 py-1 text-[12px] font-semibold text-ink backdrop-blur">
                  {example.category}
                </span>
              </div>
              <div className="p-5">
                <h3 className="text-[18px] font-bold text-ink">{example.name}</h3>
                <p className="mt-1 text-[14px] text-ink-muted">{example.tagline}</p>
              </div>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
