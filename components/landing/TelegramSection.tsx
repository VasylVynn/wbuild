import { Bell, Clock, Zap } from "lucide-react";
import { Reveal } from "./Reveal";
import { TelegramCard } from "./TelegramCard";

/**
 * The core value band: lead form → the owner's Telegram. Deep-ink surface so it
 * reads as the one thing on the page that is not a feature but the product.
 */
const perks = [
  { icon: Zap, title: "Миттєво", text: "Заявка приходить за секунди після надсилання форми." },
  { icon: Bell, title: "Не загубиться", text: "Сповіщення прямо в Telegram — там, де ви вже є." },
  { icon: Clock, title: "Швидка відповідь", text: "Телефонуйте клієнту, поки він ще гарячий." },
];

export function TelegramSection() {
  return (
    <section className="relative overflow-hidden bg-brand py-16 text-white sm:py-24">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
        <Reveal>
          <span className="text-[14px] font-bold text-honey">Заявки в Telegram</span>
          <h2 className="mt-2 text-balance font-brand text-[28px] font-semibold leading-tight tracking-tight sm:text-[36px]">
            Кожен клієнт — прямо у вашому месенджері
          </h2>
          <p className="mt-4 max-w-md text-pretty text-[16px] leading-relaxed text-white/70">
            Не треба перевіряти пошту чи заходити в адмінку. Клієнт залишив заявку — і вона вже у вас
            у Telegram з імʼям, телефоном і повідомленням.
          </p>

          <div className="mt-8 flex flex-col gap-4">
            {perks.map((perk) => (
              <div key={perk.title} className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-honey text-honey-text">
                  <perk.icon size={16} />
                </span>
                <div>
                  <p className="text-[16px] font-semibold">{perk.title}</p>
                  <p className="text-[14px] text-white/60">{perk.text}</p>
                </div>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal delay={120} className="relative">
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-6 rounded-[2rem] opacity-40 blur-2xl"
            style={{ background: "radial-gradient(circle, var(--color-honey) 0%, transparent 70%)" }}
          />
          <div className="relative flex flex-col gap-3">
            <div className="animate-ui-float">
              <TelegramCard />
            </div>
            <div className="ml-6 opacity-90">
              <div className="rounded-2xl border border-white/10 bg-surface/95 p-4 text-ink shadow-card">
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-bold">3minsite • Заявки</span>
                  <span className="text-[10px] text-ink-faint">2 хв тому</span>
                </div>
                <p className="mt-1 text-[14px]">
                  <span className="font-semibold">Нова заявка!</span> Андрій — «Торт Наполеон на 12
                  персон, на суботу»
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
