import { ArrowRight } from "lucide-react";
import { Logo } from "./Logo";
import { Reveal } from "./Reveal";
import { CtaLink } from "./CtaLink";

/**
 * Closing CTA card + the page's only footer. Nav here is anchors, the two legal
 * pages (WayForPay merchant review requires both reachable from the landing)
 * and the two real destinations on the dashboard host, passed down from the page.
 */
export function SiteFooter({ loginUrl }: { loginUrl: string }) {
  return (
    <footer className="mx-auto max-w-6xl px-4 pb-10 sm:px-6">
      <Reveal className="relative overflow-hidden rounded-[2rem] bg-brand px-6 py-14 text-center text-white sm:px-12 sm:py-20">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-20 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(circle, var(--color-honey) 0%, transparent 70%)" }}
        />
        <div className="relative">
          <h2 className="mx-auto max-w-xl text-balance font-brand text-[28px] font-semibold leading-tight tracking-tight sm:text-[36px]">
            Ваш сайт чекає. Створимо його просто зараз?
          </h2>
          <p className="mx-auto mt-4 max-w-md text-[16px] text-white/70">
            Кілька хвилин — і у вас буде сайт, який приймає заявки просто в Telegram.
          </p>
          {/* #chat, not app./new: the conversation lives in THIS origin's
              localStorage — navigating cross-host mid-dialogue lands the user
              in an empty chat and reads as lost work. Same label = same
              behavior as the header CTAs (design review 2026-08-10). */}
          <CtaLink
            href="#chat"
            placement="footer"
            className="group mt-8 inline-flex min-h-13 items-center justify-center gap-2 rounded-full bg-honey px-8 font-ui text-[16px] font-bold text-honey-text transition-[filter] hover:brightness-95"
          >
            Створити сайт
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
          </CtaLink>
          <p className="mt-4 text-[14px] text-white/60">
            Сайт і публікація — безкоштовно. 999 грн на рік — лише за власний домен.
          </p>
        </div>
      </Reveal>

      <div className="mt-12 flex flex-col items-center justify-between gap-6 border-t border-line pt-8 sm:flex-row">
        <Logo href="/" />
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[14px] text-ink-muted">
          <a href="#how" className="transition-colors hover:text-ink">
            Як це працює
          </a>
          <a href="#examples" className="transition-colors hover:text-ink">
            Приклади
          </a>
          <a href="#features" className="transition-colors hover:text-ink">
            Можливості
          </a>
          <a href="/oferta" className="transition-colors hover:text-ink">
            Публічна оферта
          </a>
          <a href="/privacy" className="transition-colors hover:text-ink">
            Конфіденційність
          </a>
          <a href={loginUrl} className="transition-colors hover:text-ink">
            Увійти
          </a>
        </nav>
        {/* ink-muted, not ink-faint: 12px text at ink-faint measures 2.86:1 on
            canvas — below WCAG 4.5:1 (design review 2026-08-10). */}
        <p className="text-[12px] text-ink-muted">© 2026 3minsite. Зроблено в Україні.</p>
      </div>
    </footer>
  );
}
