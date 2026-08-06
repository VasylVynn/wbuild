"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Lock, Mail, MailCheck } from "lucide-react";
import { signInAction, signInWithGoogleAction, signUpAction } from "./actions";
import { Button, Field, Input } from "@/components/ui";
import { AuthShell, GoogleIcon } from "@/components/auth/AuthShell";
import { phCapture } from "@/components/analytics/PostHogProvider";

/**
 * Auth page for the dashboard host (public path /login). One screen, two modes
 * («Увійти» / «Зареєструватися»), split-panel on desktop via AuthShell (form
 * left, brand right). Plain-language errors. On success the server action
 * redirects to /sites (or ?next=, when present and same-origin); here we only
 * surface errors and the "confirm your email" state.
 */
type Mode = "signin" | "signup";

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
  const [error, setError] = useState(
    // /auth/callback bounces here when the OAuth code exchange fails.
    searchParams.get("error") === "oauth"
      ? "Не вдалося увійти через Google. Спробуйте ще раз або скористайтесь поштою."
      : "",
  );
  const [confirmSent, setConfirmSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const isSignup = mode === "signup";

  // Every message that can land here is one of a fixed set of our own Ukrainian
  // strings (uaError in ./actions maps Supabase's text onto them), so the copy
  // itself is the useful dimension and carries nothing the owner typed.
  useEffect(() => {
    if (error) phCapture("ui_auth_error", { message: error, mode });
  }, [error, mode]);

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
    // Attempts, not outcomes: a successful action redirects (throws) and never
    // comes back here, so counting after the await would only ever count failures.
    phCapture(isSignup ? "ui_signup_submitted" : "ui_signin_submitted");
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

  const handleGoogle = async () => {
    if (googleLoading) return;
    setError("");
    setGoogleLoading(true);
    phCapture("ui_google_click");
    try {
      const result = await signInWithGoogleAction(next);
      if (result?.error) setError(result.error);
    } catch (err) {
      if (err && typeof err === "object" && "digest" in err) throw err;
      setError("Щось пішло не так. Спробуйте ще раз.");
    } finally {
      setGoogleLoading(false);
    }
  };

  if (confirmSent) {
    return (
      <AuthShell centered>
        <div className="animate-pop mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-full bg-honey-soft text-honey-text">
          <MailCheck size={32} />
        </div>
        <h1 className="animate-rise mt-6 font-brand text-[26px] font-semibold text-ink">
          Перевірте пошту
        </h1>
        <p className="animate-rise mt-2 text-[17px] leading-relaxed text-ink-muted">
          Ми надіслали лист для підтвердження на <b className="text-ink">{email}</b>. Відкрийте його
          й натисніть на посилання — і зможете увійти.
        </p>
        <Button
          variant="secondary"
          onClick={() => switchMode("signin")}
          className="mt-6 rounded-full"
        >
          Повернутися до входу
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
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

      <div className="animate-rise mt-6">
        <Button
          type="button"
          variant="secondary"
          size="lg"
          disabled={googleLoading}
          onClick={handleGoogle}
          className="w-full rounded-full"
        >
          <GoogleIcon />
          {googleLoading ? "Зачекайте…" : "Продовжити з Google"}
        </Button>

        <div className="mt-5 flex items-center gap-3 text-[13px] font-semibold text-ink-faint">
          <span className="h-px flex-1 bg-line-strong" />
          або з поштою
          <span className="h-px flex-1 bg-line-strong" />
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate className="animate-rise mt-5 flex flex-col gap-4">
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
    </AuthShell>
  );
}
