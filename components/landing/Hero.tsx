import Image from "next/image";
import { ArrowRight, Phone, Send, Sparkles, Star } from "lucide-react";
import { TelegramCard } from "./TelegramCard";

/**
 * Hero — sells the FUNNEL, not the site: «Клієнти з інтернету — прямо у ваш
 * Telegram». Left column carries the promise and the only primary CTA; right
 * column shows the two ends of it at once — a finished phone site, and the
 * Telegram ping the owner gets when someone fills its form.
 */
export function Hero({ newUrl }: { newUrl: string }) {
  return (
    <section className="relative overflow-hidden pt-28 pb-10 sm:pt-36 sm:pb-16">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full opacity-50 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--color-honey) 0%, transparent 65%)" }}
      />

      <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
        <div className="text-center lg:text-left">
          <span className="animate-rise inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-[12px] font-semibold text-ink-muted shadow-card">
            <Sparkles size={14} className="text-honey-text" />
            Готовий сайт за 3 хвилини
          </span>

          <h1 className="animate-rise mt-5 text-balance font-brand text-[34px] font-semibold leading-[1.08] tracking-tight sm:text-[44px] lg:text-[54px]">
            Клієнти з інтернету — прямо у ваш{" "}
            <span className="relative whitespace-nowrap">
              <span className="relative z-10">Telegram</span>
              <span
                aria-hidden
                className="absolute inset-x-0 bottom-1 z-0 h-3.5 rounded-full bg-honey sm:h-4"
              />
            </span>
          </h1>

          <p className="animate-rise mx-auto mt-5 max-w-md text-pretty text-[17px] leading-relaxed text-ink-muted sm:text-[19px] lg:mx-0">
            Розкажіть про свою справу — помічник збере сайт, а заявки від клієнтів прилетять прямо у
            ваш месенджер.
          </p>

          <div className="animate-rise mt-8 flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
            <a
              href={newUrl}
              className="group inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-full bg-brand px-7 font-ui text-[16px] font-bold text-white transition-colors hover:bg-brand-hover sm:w-auto"
            >
              Створити сайт безкоштовно
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
            </a>
            <a
              href="#examples"
              className="inline-flex min-h-13 w-full items-center justify-center rounded-full border-[1.5px] border-line-strong bg-surface px-7 font-ui text-[16px] font-semibold text-ink transition-colors hover:bg-sunken sm:w-auto"
            >
              Подивитись приклади
            </a>
          </div>

          <div className="animate-rise mt-6 flex flex-wrap items-center justify-center gap-4 text-[13px] text-ink-muted lg:justify-start">
            {["Без коду", "Без дизайнера", "Без карток"].map((claim) => (
              <span key={claim} className="flex items-center gap-1.5">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-honey" />
                {claim}
              </span>
            ))}
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-sm">
          <div className="animate-ui-float relative mx-auto w-[17rem] sm:w-[19rem]">
            <div className="relative rounded-[2.75rem] border-[6px] border-ink bg-ink shadow-[0_40px_80px_-20px_rgba(60,40,10,0.35)]">
              <div
                aria-hidden
                className="absolute left-1/2 top-2 z-20 h-5 w-24 -translate-x-1/2 rounded-full bg-ink"
              />
              <div className="relative h-[34rem] overflow-hidden rounded-[2.25rem] bg-white">
                <PhoneSitePreview />
              </div>
            </div>

            {/* The conversation that produced the site above. */}
            <div className="absolute -left-6 top-24 hidden w-44 rotate-[-4deg] rounded-2xl rounded-bl-sm border border-line bg-surface p-3 shadow-card sm:block">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-honey-text">
                <Sparkles size={12} /> Помічник
              </div>
              <p className="mt-1 text-[11px] leading-snug text-ink">Як називається ваша справа?</p>
            </div>
            <div className="absolute -right-4 top-44 hidden w-40 rotate-[3deg] items-center gap-2 rounded-2xl rounded-br-sm bg-brand p-3 text-white shadow-card sm:flex">
              <p className="text-[11px] leading-snug">Квіти від Олени 🌷</p>
              <Send size={12} className="shrink-0 opacity-70" />
            </div>
          </div>

          <div className="absolute -bottom-4 left-1/2 w-64 -translate-x-1/2 sm:-right-8 sm:left-auto sm:bottom-8 sm:translate-x-0">
            <TelegramCard compact />
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * A finished tenant site, drawn at phone scale. Static by design — it is a
 * picture of the output, not the renderer (components/PageRenderer owns that).
 */
function PhoneSitePreview() {
  return (
    <div className="no-scrollbar h-full w-full overflow-hidden bg-white text-ink">
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <span className="text-[13px] font-bold tracking-tight">Квіти від Олени</span>
        <span className="rounded-full bg-[#c2536b] px-2.5 py-1 text-[10px] font-semibold text-white">
          Замовити
        </span>
      </header>

      <div className="relative">
        <Image
          src="/landing/phone-hero.webp"
          alt="Квіти від Олени — приклад головного фото сайту"
          width={620}
          height={420}
          className="h-40 w-full object-cover"
          priority
        />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-4">
          <span className="mb-1.5 inline-block rounded-full bg-[#c2536b] px-2.5 py-0.5 text-[9px] font-semibold text-white">
            Квіткова майстерня
          </span>
          <p className="text-[17px] font-bold leading-tight text-white">Букети, які запамʼятовують</p>
        </div>
      </div>

      <section className="px-4 py-4">
        <h2 className="mb-1.5 text-[12px] font-bold">Про нас</h2>
        <p className="text-[10px] leading-relaxed text-ink-muted">
          Авторська квіткова майстерня у Києві. Збираємо букети та композиції під кожну подію.
        </p>
      </section>

      <section className="bg-sunken px-4 py-4">
        <h2 className="mb-2 text-[12px] font-bold">Послуги</h2>
        <div className="flex flex-col gap-1.5">
          {["Авторські букети", "Композиції на подію", "Доставка по місту"].map((service) => (
            <div
              key={service}
              className="flex items-center gap-2 rounded-lg border border-line bg-white px-2.5 py-1.5"
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#c2536b] text-white">
                <Star size={11} />
              </span>
              <span className="text-[10px] font-medium text-ink">{service}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 py-4">
        <div className="rounded-xl bg-[#c2536b] p-3.5 text-white">
          <h2 className="text-[12px] font-bold">Залишити заявку</h2>
          <p className="mt-0.5 text-[10px] opacity-90">Звʼяжемось із вами протягом 15 хвилин</p>
          <div className="mt-2.5 flex flex-col gap-1.5">
            <span className="rounded-lg bg-white/90 px-2.5 py-1.5 text-[10px] text-ink-faint">
              Ваше імʼя
            </span>
            <span className="rounded-lg bg-white/90 px-2.5 py-1.5 text-[10px] text-ink-faint">
              Телефон
            </span>
            <span className="rounded-lg bg-ink px-2.5 py-1.5 text-center text-[10px] font-semibold">
              Надіслати заявку
            </span>
          </div>
          <p className="mt-2.5 flex items-center gap-1.5 border-t border-white/20 pt-2.5 text-[10px]">
            <Phone size={11} /> +380 67 214 88 12
          </p>
        </div>
      </section>
    </div>
  );
}
