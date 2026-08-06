"use client";

import { Check, Sparkles } from "lucide-react";
import { Logo } from "@/components/landing/Logo";
import { TelegramCard } from "@/components/landing/TelegramCard";

/**
 * Shared chrome for every auth screen (/login, /reset, /reset/confirm) —
 * split-panel: form column left, brand panel right on lg+. Success states
 * (`centered`) render inside the SAME full-width shell, so the canvas
 * background always covers the viewport (the old standalone `max-w-md` main
 * left white gutters on desktop).
 */

const HOME_HREF = process.env.NEXT_PUBLIC_ROOT_DOMAIN
  ? `//${process.env.NEXT_PUBLIC_ROOT_DOMAIN}`
  : "/";

const promises = [
  "Сайт створюється за коротку розмову з помічником",
  "Кожна заявка з сайту миттєво падає в месенджер",
  "Редагується дотиком — без конструкторів і налаштувань",
];

function BrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden bg-brand text-white lg:flex lg:w-1/2">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 top-1/3 h-96 w-96 rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--color-honey) 0%, transparent 70%)" }}
      />
      <div className="relative flex flex-col justify-between gap-10 p-12 xl:p-16">
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-[12px] font-semibold text-honey">
          <Sparkles size={14} /> 3minsite для вашої справи
        </span>

        <div>
          <h2 className="max-w-md text-balance font-brand text-[32px] font-semibold leading-tight tracking-tight">
            Клієнти з інтернету — прямо у ваш Telegram
          </h2>
          <ul className="mt-8 flex max-w-md flex-col gap-3 text-[16px] text-white/75">
            {promises.map((line) => (
              <li key={line} className="flex items-start gap-3">
                <Check size={18} className="mt-0.5 shrink-0 text-honey" />
                <span>{line}</span>
              </li>
            ))}
          </ul>

          <div className="animate-ui-float mt-10 max-w-sm">
            <TelegramCard />
          </div>
        </div>

        <p className="text-[14px] text-white/50">Без технічних знань і складних налаштувань.</p>
      </div>
    </aside>
  );
}

export function AuthShell({
  children,
  centered = false,
  footer,
}: {
  children: React.ReactNode;
  /** Success/status states: center the content block instead of the form column. */
  centered?: boolean;
  /** Bottom-left link of the form column («← На головну» by default). */
  footer?: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen bg-canvas">
      <div className="flex w-full flex-col px-5 py-6 sm:px-10 lg:w-1/2">
        <Logo href={HOME_HREF} />

        <div className="flex flex-1 items-center justify-center py-10">
          <div className={`w-full max-w-sm ${centered ? "text-center" : ""}`}>{children}</div>
        </div>

        {footer ?? (
          <a
            href={HOME_HREF}
            className="text-[14px] font-semibold text-ink-muted transition-colors hover:text-ink"
          >
            ← На головну
          </a>
        )}
      </div>

      <BrandPanel />
    </main>
  );
}

/** The four-color Google mark, inline so no external asset is fetched. */
export function GoogleIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.7 1.22 9.19 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
