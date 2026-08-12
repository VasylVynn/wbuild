"use client";

import dynamic from "next/dynamic";

/**
 * Client island for the landing hero chat (landing-chat-first plan §3.1, W1).
 *
 * LCP: OnboardChat is a large client component. Importing it statically would
 * drag it into the critical bundle under the h1, so it loads via
 * dynamic(ssr: false) — the server shell (h1 + this placeholder) paints first,
 * then the chat hydrates in place. The placeholder mirrors the embedded card's
 * exact shell (same height/radius/border) so the swap causes no layout shift.
 *
 * M11 — best-effort degradation, documented: auth cookies are scoped to the
 * app host (app.<root>), so the ROOT landing cannot see login state and there
 * is no cheap root-host signal for «has a site already». Default therefore =
 * the chat for everyone. The full M11 variant («Ваш сайт: редагувати /
 * заявки», chat collapsed to "create another") waits for the cookie-domain
 * unification explicitly deferred in plan §4 — do NOT fake it with
 * cross-origin hacks.
 */
const OnboardChat = dynamic(
  () => import("@/components/onboard/OnboardChat").then((m) => m.OnboardChat),
  { ssr: false, loading: () => <ChatCardPlaceholder /> },
);

// Mirrors OnboardChat's GREETING / IG_GREETING so the placeholder → live swap
// doesn't flash different copy. Module-scoped so the placeholder can read it
// (next/dynamic `loading` takes no props).
let placeholderIg = false;

export function HeroChat({ igImportEnabled }: { igImportEnabled: boolean }) {
  placeholderIg = igImportEnabled;
  return <OnboardChat embedded igImportEnabled={igImportEnabled} source="landing" />;
}

/**
 * Static twin of the embedded chat card while the real bundle loads. Purely
 * visual — no handlers; the composer is a disabled lookalike. Class strings
 * copy the embedded-card shell in OnboardChat (h-[min(560px,72dvh)] etc.).
 */
function ChatCardPlaceholder() {
  const greeting = placeholderIg
    ? "Вітаю! 👋 Надішліть посилання на свою Instagram-сторінку — і я зберу з неї сайт прямо в цій розмові, щоб вас знаходили не лише в Instagram, а й у Google. Візьму звідти фото, послуги й контакти — а ви підтвердите. Або просто розкажіть, що у вас за бізнес."
    : "Вітаю! 👋 Створю сайт для вашого бізнесу прямо в цій розмові — опублікований сайт можна знайти в Google. Розкажіть, що у вас за бізнес — для початку досить назви.";
  return (
    <div className="relative flex h-[min(560px,72dvh)] flex-col overflow-hidden rounded-[24px] border border-line bg-canvas text-ink shadow-card">
      <header className="border-b border-line bg-surface/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-4 py-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/clock.svg" alt="" aria-hidden className="h-11 w-11 shrink-0" />
          <div className="flex flex-col leading-tight">
            <span className="font-brand text-[17px] font-semibold text-ink">Помічник</span>
            <span className="flex items-center gap-1.5 text-[13px] font-bold text-ok">
              <span className="h-1.5 w-1.5 rounded-full bg-ok" aria-hidden />
              онлайн
            </span>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden px-4 py-4">
        <div className="mx-auto w-full max-w-2xl">
          <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-line bg-surface px-4 py-3 text-[16px] leading-relaxed text-ink shadow-card">
            {greeting}
          </div>
        </div>
      </div>

      <footer className="border-t border-line bg-surface/85 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-2.5">
          <div className="flex h-14 min-w-0 flex-1 items-center rounded-full border border-line-strong bg-surface px-5 text-[17px] text-ink-muted">
            Написати…
          </div>
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand opacity-45 text-white" />
        </div>
      </footer>
    </div>
  );
}
