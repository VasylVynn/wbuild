import { MessageCircle, Send, Sparkles } from "lucide-react";
import { Reveal } from "./Reveal";

/**
 * The three steps of the funnel, in the owner's language: a conversation, a
 * live site, leads in Telegram. No configuration, no builder vocabulary.
 */
const steps = [
  {
    icon: MessageCircle,
    title: "Розкажіть про свою справу",
    text: "Відповідайте на кілька простих запитань у чаті — своїми словами, без жодних термінів.",
  },
  {
    icon: Sparkles,
    title: "Отримайте готовий сайт",
    text: "Помічник збирає сайт із текстами, послугами й формою заявок — і той одразу живий в інтернеті.",
  },
  {
    icon: Send,
    title: "Приймайте заявки в Telegram",
    text: "Кожна заявка з сайту миттєво прилітає у ваш месенджер. Нічого не загубиться.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16 sm:px-6 sm:py-24">
      <Reveal className="mx-auto max-w-2xl text-center">
        <span className="text-[14px] font-bold text-honey-text">Як це працює</span>
        <h2 className="mt-2 text-balance font-brand text-[28px] font-semibold leading-tight tracking-tight sm:text-[36px]">
          Три кроки до сайту, який приносить заявки
        </h2>
      </Reveal>

      <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
        {steps.map((step, i) => (
          <Reveal key={step.title} delay={i * 120}>
            <div className="relative h-full rounded-3xl border border-line bg-surface p-6 shadow-card transition-all hover:-translate-y-1 hover:shadow-lg">
              <span
                aria-hidden
                className="absolute right-6 top-5 font-brand text-[44px] font-semibold leading-none text-sunken"
              >
                {i + 1}
              </span>
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-honey text-honey-text">
                <step.icon size={24} />
              </span>
              <h3 className="mt-5 text-[19px] font-bold leading-snug text-ink">{step.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">{step.text}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
