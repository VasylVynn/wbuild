import type { ReactNode } from "react";
import { ROOT_DOMAIN } from "@/lib/config";

/**
 * 3minsite marketing landing — served on the root/www platform hosts (§2.5).
 * Sells the FUNNEL, not the site: «Клієнти з інтернету — прямо у ваш Telegram».
 *
 * Fully server-rendered (no "use client"): links are styled as buttons with the
 * same Tailwind as components/ui Button, and the wordmark is inlined so the page
 * never crosses a client boundary. Light theme only, Ukrainian copy, phone-first.
 */

// CTA targets live on the dashboard host (app.<root>). ROOT_DOMAIN carries the
// dev port (lvh.me:3000) and drops it in prod — mirror app/new/actions.ts.
const isProd = process.env.NODE_ENV === "production";
const APP_HOST = `${isProd ? "https" : "http"}://app.${ROOT_DOMAIN}`;
const NEW_URL = `${APP_HOST}/new`;
const LOGIN_URL = `${APP_HOST}/login`;

// Mirror components/ui Button so the landing matches the product without pulling
// its "use client" primitives onto a server page.
const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-[16px] font-ui font-bold text-white bg-brand hover:bg-brand-hover transition-colors min-h-14 px-8 text-[18px]";
const btnHoney =
  "inline-flex items-center justify-center gap-2 rounded-[16px] font-ui font-bold text-ink bg-honey hover:brightness-95 transition-all min-h-14 px-8 text-[18px]";
const btnQuiet =
  "inline-flex items-center justify-center rounded-[16px] font-ui font-semibold text-ink-muted hover:bg-sunken transition-colors min-h-11 px-4 text-[16px]";

function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`select-none font-brand font-semibold tracking-tight text-ink ${className}`}>
      <span className="text-honey">3</span>minsite
    </span>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="mb-3 font-ui text-[13px] font-bold uppercase tracking-[0.14em] text-honey-text">
      {children}
    </p>
  );
}

export default function PlatformHome() {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Wordmark className="text-[22px]" />
        <a href={LOGIN_URL} className={btnQuiet}>
          Увійти
        </a>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* «Небо і мед» — soft honey + sky glows, not a SaaS gradient blob. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 right-[-10%] h-80 w-80 rounded-full bg-honey-soft opacity-70 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 left-[-10%] h-72 w-72 rounded-full bg-brand-soft opacity-60 blur-3xl"
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-8 sm:px-8 sm:pb-24 sm:pt-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:pb-28">
          <div>
            <h1 className="font-brand text-[34px] font-semibold leading-[1.08] tracking-tight sm:text-[44px] lg:text-[56px]">
              Клієнти з інтернету — прямо у ваш <span className="text-tg-dark">Telegram</span>
            </h1>
            <p className="mt-5 max-w-xl text-[18px] leading-relaxed text-ink-muted sm:text-[20px]">
              Сайт для вашої справи створиться сам за коротку розмову. Кожна заявка від клієнта —
              миттєво у ваш месенджер.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <a href={NEW_URL} className={btnPrimary}>
                Створити сайт безкоштовно
              </a>
            </div>
            <p className="mt-4 flex items-center gap-2 text-[15px] text-ink-faint">
              <span aria-hidden className="text-ok">✓</span>
              Без карток і без технічних знань
            </p>
          </div>

          {/* Concrete proof of the promise: a Telegram-style lead notification. */}
          <div className="lg:justify-self-end">
            <LeadCardMock />
          </div>
        </div>
      </section>

      {/* ── Як це працює ────────────────────────────────────────────────── */}
      <section className="border-t border-line bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
          <div className="max-w-2xl">
            <Eyebrow>3 кроки</Eyebrow>
            <h2 className="font-brand text-[28px] font-semibold leading-tight tracking-tight sm:text-[36px]">
              Як це працює
            </h2>
          </div>
          <div className="mt-10 grid gap-5 sm:mt-12 sm:grid-cols-3">
            <Step n="1" title="Розкажіть про свою справу у чаті">
              Помічник ставить прості запитання — ви просто відповідаєте своїми словами.
            </Step>
            <Step n="2" title="Отримайте готовий сайт на своїй адресі">
              За кілька хвилин сайт живий у інтернеті — з текстами, послугами й контактами.
            </Step>
            <Step n="3" title="Приймайте заявки в Telegram">
              Клієнт залишає заявку на сайті — ви бачите її одразу в улюбленому месенджері.
            </Step>
          </div>
        </div>
      </section>

      {/* ── Що ви отримуєте ─────────────────────────────────────────────── */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
          <div className="max-w-2xl">
            <Eyebrow>Усе включено</Eyebrow>
            <h2 className="font-brand text-[28px] font-semibold leading-tight tracking-tight sm:text-[36px]">
              Що ви отримуєте
            </h2>
          </div>
          <div className="mt-10 grid gap-5 sm:mt-12 sm:grid-cols-2">
            <Feature emoji="🌿" title="Сайт, що викликає довіру">
              Охайний, теплий і сучасний — такий, що клієнту хочеться залишитись і написати вам.
            </Feature>
            <Feature emoji="💬" title="Заявки в Telegram" accent>
              Ніяких пропущених листів і незручних форм — усі звернення падають прямо у ваш чат.
            </Feature>
            <Feature emoji="✏️" title="Простий редактор — жодних конструкторів">
              Змінити текст чи ціну можна за хвилину, з телефону. Без блоків, сіток і налаштувань.
            </Feature>
            <Feature emoji="💡" title="Помічник, який радить, що написати">
              Не знаєте, як описати послугу? Помічник підкаже слова, які працюють на клієнта.
            </Feature>
          </div>
        </div>
      </section>

      {/* ── Для кого ────────────────────────────────────────────────────── */}
      <section className="border-t border-line bg-surface">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="max-w-2xl">
            <Eyebrow>Для кого</Eyebrow>
            <h2 className="font-brand text-[28px] font-semibold leading-tight tracking-tight sm:text-[36px]">
              Для будь-якої справи, яка чекає на клієнтів
            </h2>
          </div>
          <ul className="mt-8 flex flex-wrap gap-3">
            {[
              { emoji: "💐", label: "Квіткарня" },
              { emoji: "🥐", label: "Пекарня" },
              { emoji: "⚖️", label: "Юрист" },
              { emoji: "🔧", label: "Автосервіс" },
              { emoji: "💅", label: "Салон краси" },
            ].map((v) => (
              <li
                key={v.label}
                className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-canvas px-4 py-2.5 text-[16px] font-semibold text-ink"
              >
                <span aria-hidden>{v.emoji}</span>
                {v.label}
              </li>
            ))}
            <li className="inline-flex items-center gap-2 rounded-full border border-transparent bg-honey-soft px-4 py-2.5 text-[16px] font-bold text-honey-text">
              <span aria-hidden>✦</span>
              Будь-яка справа
            </li>
          </ul>
        </div>
      </section>

      {/* ── Final CTA band ──────────────────────────────────────────────── */}
      <section className="bg-brand">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-7 px-5 py-16 text-center sm:px-8 sm:py-24">
          <h2 className="max-w-3xl font-brand text-[28px] font-semibold leading-tight tracking-tight text-white sm:text-[40px]">
            Спробуйте — перший сайт займе кілька хвилин
          </h2>
          <p className="max-w-xl text-[17px] text-brand-soft sm:text-[19px]">
            Розкажіть про свою справу помічнику — і вже сьогодні приймайте заявки в Telegram.
          </p>
          <a href={NEW_URL} className={btnHoney}>
            Створити сайт безкоштовно
          </a>
          <p className="text-[15px] text-brand-soft">Без карток і без технічних знань</p>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 sm:flex-row sm:px-8">
          <Wordmark className="text-[20px]" />
          <p className="text-[14px] text-ink-faint">© 2026 3minsite</p>
          <a href={LOGIN_URL} className="text-[15px] font-semibold text-ink-muted hover:text-ink">
            Увійти
          </a>
        </div>
      </footer>
    </div>
  );
}

// ── Section building blocks (server components — no client boundary) ────────

function Step({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <div className="rounded-card border border-line bg-canvas p-6 shadow-card">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-honey-soft font-brand text-[22px] font-semibold text-honey-text">
        {n}
      </span>
      <h3 className="mt-5 text-[19px] font-bold leading-snug text-ink">{title}</h3>
      <p className="mt-2 text-[16px] leading-relaxed text-ink-muted">{children}</p>
    </div>
  );
}

function Feature({
  emoji,
  title,
  children,
  accent,
}: {
  emoji: string;
  title: string;
  children: ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-card border p-6 shadow-card sm:p-7 ${
        accent ? "border-transparent bg-[#E4F4FB]" : "border-line bg-surface"
      }`}
    >
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-[14px] text-[24px] ${
          accent ? "bg-white" : "bg-sunken"
        }`}
      >
        <span aria-hidden>{emoji}</span>
      </div>
      <h3 className={`mt-5 text-[20px] font-bold leading-snug ${accent ? "text-tg-dark" : "text-ink"}`}>
        {title}
      </h3>
      <p className="mt-2 text-[16px] leading-relaxed text-ink-muted">{children}</p>
    </div>
  );
}

/** A Telegram-style «нова заявка» card — shows the funnel's payoff, no images. */
function LeadCardMock() {
  return (
    <div className="w-full max-w-sm rounded-sheet border border-line bg-surface p-5 shadow-card">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-tg font-brand text-[18px] font-semibold text-white">
          3
        </span>
        <div className="min-w-0">
          <p className="text-[15px] font-bold text-ink">3minsite</p>
          <p className="text-[13px] text-ink-faint">бот · щойно</p>
        </div>
      </div>
      <div className="mt-4 rounded-[20px] rounded-tl-[6px] border border-line bg-canvas p-4">
        <p className="text-[14px] font-bold uppercase tracking-wide text-tg-dark">🔔 Нова заявка</p>
        <dl className="mt-3 space-y-1.5 text-[15px]">
          <div className="flex gap-2">
            <dt className="text-ink-faint">Ім’я:</dt>
            <dd className="font-semibold text-ink">Олена</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-ink-faint">Телефон:</dt>
            <dd className="font-semibold text-ink">+380 67 123 45 67</dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 text-ink-faint">Повідомлення:</dt>
            <dd className="text-ink">Хочу букет півоній на суботу 🌸</dd>
          </div>
        </dl>
      </div>
      <div className="mt-3 flex justify-end">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tg px-4 py-2 text-[14px] font-bold text-white">
          Відповісти
        </span>
      </div>
    </div>
  );
}
