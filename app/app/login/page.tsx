"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check, Lock, Mail, MailCheck, Sparkles } from "lucide-react";
import { signInAction, signUpAction } from "./actions";
import { Button, Field, Input } from "@/components/ui";
import { Logo } from "@/components/landing/Logo";
import { TelegramCard } from "@/components/landing/TelegramCard";

/**
 * Auth page for the dashboard host (public path /login). One screen, two modes
 * («Увійти» / «Зареєструватися»), split-panel on desktop (form left, brand
 * right). Plain-language errors. On success the server action redirects to
 * /sites (or ?next=, when present and same-origin); here we only surface
 * errors and the "confirm your email" state.
 */
type Mode = "signin" | "signup";

/* «На головну» must leave the app host for the marketing root — a bare "/" on
   app.* just bounces a logged-out visitor back to this login page. */
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

        <p className="text-[14px] text-white/50">Без карток і без технічних знань.</p>
      </div>
    </aside>
  );
}

export default function LoginPage() {
  // useSearchParams opts the page out of static rendering — Next.js requires
  // it to sit under a Suspense boundary.
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? undefined;

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [confirmSent, setConfirmSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const isSignup = mode === "signup";

  const switchMode = (nextMode: Mode) => {
    setMode(nextMode);
    setError("");
    setConfirmSent(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      const result = isSignup
        ? await signUpAction(email, password, next)
        : await signInAction(email, password, next);
      // On success the action redirects (throws) — we only get here on a
      // returned result, which always means an error or the confirm state.
      if (result && "needsConfirmation" in result) {
        setConfirmSent(true);
      } else if (result?.error) {
        setError(result.error);
      }
    } catch (err) {
      // NEXT_REDIRECT propagates as a thrown error — let Next handle it.
      if (err && typeof err === "object" && "digest" in err) throw err;
      setError("Щось пішло не так. Спробуйте ще раз.");
    } finally {
      setLoading(false);
    }
  };

  if (confirmSent) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-2 bg-canvas px-6 py-16 text-center">
        <div className="animate-pop flex h-[72px] w-[72px] items-center justify-center rounded-full bg-honey-soft text-honey-text">
          <MailCheck size={32} />
        </div>
        <h1 className="animate-rise mt-6 font-brand text-[26px] font-semibold text-ink">
          Перевірте пошту
        </h1>
        <p className="animate-rise text-[17px] leading-relaxed text-ink-muted">
          Ми надіслали лист для підтвердження на <b className="text-ink">{email}</b>. Відкрийте його й
          натисніть на посилання — і зможете увійти.
        </p>
        <Button
          variant="secondary"
          onClick={() => switchMode("signin")}
          className="mt-6 rounded-full"
        >
          Повернутися до входу
        </Button>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen bg-canvas">
      <div className="flex w-full flex-col px-5 py-6 sm:px-10 lg:w-1/2">
        <Logo href={HOME_HREF} />

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">
            <div className="animate-rise">
              <h1 className="text-balance font-brand text-[28px] font-semibold tracking-tight text-ink">
                {isSignup ? "Створіть акаунт" : "З поверненням"}
              </h1>
              <p className="mt-2 text-[15px] text-ink-muted">
                {isSignup
                  ? "Кілька секунд — і почнемо збирати ваш сайт."
                  : "Увійдіть, щоб керувати сайтами та заявками."}
              </p>
            </div>

            <div className="animate-rise mt-6 grid grid-cols-2 gap-1 rounded-full bg-sunken p-1">
              <button
                type="button"
                onClick={() => switchMode("signin")}
                className={`rounded-full py-2.5 text-[15px] font-semibold transition-all ${
                  !isSignup ? "bg-surface text-ink shadow-card" : "text-ink-muted hover:text-ink"
                }`}
              >
                Вхід
              </button>
              <button
                type="button"
                onClick={() => switchMode("signup")}
                className={`rounded-full py-2.5 text-[15px] font-semibold transition-all ${
                  isSignup ? "bg-surface text-ink shadow-card" : "text-ink-muted hover:text-ink"
                }`}
              >
                Реєстрація
              </button>
            </div>

            <form onSubmit={handleSubmit} noValidate className="animate-rise mt-6 flex flex-col gap-4">
              <Field label="Електронна пошта">
                <div className="relative">
                  <Mail
                    aria-hidden
                    size={16}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint"
                  />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ваш@email.com"
                    autoComplete="email"
                    required
                    className="pl-10"
                  />
                </div>
              </Field>

              <Field label="Пароль">
                <div className="relative">
                  <Lock
                    aria-hidden
                    size={16}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint"
                  />
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={isSignup ? "Мінімум 6 символів" : "Ваш пароль"}
                    autoComplete={isSignup ? "new-password" : "current-password"}
                    required
                    className="pl-10"
                  />
                </div>
              </Field>

              {!isSignup && (
                <Link
                  href="/reset"
                  className="-mt-1 self-end text-[14px] font-semibold text-ink-muted transition-colors hover:text-ink"
                >
                  Забули пароль?
                </Link>
              )}

              {error && (
                <p className="rounded-2xl bg-danger-soft px-4 py-3.5 text-[15px] font-semibold text-danger">
                  {error}
                </p>
              )}

              <Button type="submit" size="lg" disabled={loading} className="mt-2 w-full rounded-full">
                {loading ? "Зачекайте…" : isSignup ? "Зареєструватися" : "Увійти"}
              </Button>
            </form>

            <p className="mt-6 text-center text-[13px] text-ink-faint">
              Продовжуючи, ви погоджуєтесь з умовами використання та політикою конфіденційності.
            </p>
          </div>
        </div>

        <a
          href={HOME_HREF}
          className="text-[14px] font-semibold text-ink-muted transition-colors hover:text-ink"
        >
          ← На головну
        </a>
      </div>

      <BrandPanel />
    </main>
  );
}
