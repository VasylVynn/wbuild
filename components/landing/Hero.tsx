import Image from "next/image";
import { Phone, Sparkles, Star } from "lucide-react";
import { TelegramCard } from "./TelegramCard";
import { HeroChat } from "./HeroChat";

/**
 * Hero — the chat IS the CTA (landing-chat-first plan §3.4, W1). One text h1
 * carries the promise (SEO), the embedded OnboardChat sits directly under it:
 * on mobile the chat wins the viewport (ad traffic is mobile), so the subcopy
 * hides and the phone mock is desktop-only. The old «Створити сайт» button is
 * gone — the first message in the chat replaced it; header CTAs scroll here
 * via the #chat anchor.
 *
 * Desktop keeps the phone mock + Telegram card in a side column: it shows the
 * two ends of the funnel (a finished site, the owner's Telegram ping) beside
 * the conversation that produces them. The old fake chat-bubble decorations
 * were dropped — a real chat renders right next to them.
 *
 * Price copy must stay honest about WHERE the paywall sits (owner decision
 * 2026-08-06): building AND publishing on our subdomain are free, ₴999 buys
 * the owner's own domain plus a year of running it.
 */
export function Hero({ igImportEnabled }: { igImportEnabled: boolean }) {
  return (
    <section className="relative overflow-hidden pt-20 pb-10 sm:pt-28 sm:pb-16">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full opacity-50 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--color-honey) 0%, transparent 65%)" }}
      />

      <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-start gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-14">
        <div className="text-center lg:text-left">
          {/* Badge is sm+ only — on phones every vertical px above the chat
              delays the real CTA; the claims strip below the chat carries the
              same free/999 message. */}
          <span className="hidden animate-rise items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-[12px] font-semibold text-ink-muted shadow-card sm:inline-flex">
            <Sparkles size={14} className="text-honey-text" />
            Сайт безкоштовно · Власний домен — 999 грн/рік
          </span>

          <h1 className="animate-rise text-balance font-brand text-[30px] font-semibold leading-[1.1] tracking-tight sm:mt-5 sm:text-[40px] lg:text-[46px]">
            Клієнти з інтернету — прямо у ваш{" "}
            <span className="relative whitespace-nowrap">
              <span className="relative z-10">Telegram</span>
              <span
                aria-hidden
                className="absolute inset-x-0 bottom-1 z-0 h-3 rounded-full bg-honey sm:h-3.5"
              />
            </span>
          </h1>

          <p className="mx-auto mt-4 hidden max-w-md text-pretty text-[17px] leading-relaxed text-ink-muted sm:block sm:text-[18px] lg:mx-0">
            Розкажіть про свою справу прямо тут — помічник збере сайт, а заявки від клієнтів
            прилетять у ваш месенджер.
          </p>

          {/* The chat replaces the CTA buttons (§3.4). id="chat" is the anchor
              the header CTAs scroll to; scroll-mt offsets the fixed header. */}
          <div id="chat" className="mt-4 scroll-mt-24 text-left sm:mt-6 lg:max-w-xl">
            <HeroChat igImportEnabled={igImportEnabled} />
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[13px] text-ink-muted lg:justify-start">
            {["Публікація безкоштовна", "Власний домен — 999 грн/рік", "Без коду"].map((claim) => (
              <span key={claim} className="flex items-center gap-1.5">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-honey" />
                {claim}
              </span>
            ))}
          </div>
        </div>

        {/* Desktop-only proof column: the finished phone site + the Telegram
            ping. On mobile the chat owns the viewport — the Examples section
            below carries the visual proof instead. */}
        <div className="relative hidden lg:block">
          <div className="animate-ui-float relative mx-auto w-[17rem]">
            <div className="relative rounded-[2.75rem] border-[6px] border-ink bg-ink shadow-[0_40px_80px_-20px_rgba(60,40,10,0.35)]">
              <div
                aria-hidden
                className="absolute left-1/2 top-2 z-20 h-5 w-24 -translate-x-1/2 rounded-full bg-ink"
              />
              <div className="relative h-[34rem] overflow-hidden rounded-[2.25rem] bg-white">
                <PhoneSitePreview />
              </div>
            </div>
          </div>

          <div className="absolute -bottom-4 right-0 w-64">
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
    // aria-hidden: this is a PICTURE of a generated site — its inner headings
    // must not leak into the real document outline (design review 2026-08-10).
    // pt-9 on the mock header clears the notch bar (top-2 + h-5) so it reads
    // as bezel hardware instead of overlapping the mock's own text.
    <div aria-hidden="true" className="no-scrollbar h-full w-full overflow-hidden bg-white text-ink">
      <header className="flex items-center justify-between border-b border-line px-4 pb-3 pt-9">
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
        <p className="mb-1.5 text-[12px] font-bold">Про нас</p>
        <p className="text-[10px] leading-relaxed text-ink-muted">
          Авторська квіткова майстерня у Києві. Збираємо букети та композиції під кожну подію.
        </p>
      </section>

      <section className="bg-sunken px-4 py-4">
        <p className="mb-2 text-[12px] font-bold">Послуги</p>
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
          <p className="text-[12px] font-bold">Залишити заявку</p>
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
