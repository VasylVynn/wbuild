"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signInAction, signUpAction } from "./actions";
import { Button, Field, Input, Wordmark } from "@/components/ui";

/**
 * Auth page for the dashboard host (public path /login). One screen, two modes
 * («Увійти» / «Зареєструватися»). Big touch targets and plain-language errors
 * for a non-technical 50+ audience. On success the server action redirects to
 * /sites (or ?next=, when present and same-origin); here we only surface
 * errors and the "confirm your email" state.
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
        <div className="flex h-[84px] w-[84px] items-center justify-center rounded-full bg-honey-soft text-[38px]">
          📬
        </div>
        <h1 className="mt-6 font-brand text-[24px] font-medium text-ink">Перевірте пошту</h1>
        <p className="text-[17px] leading-relaxed text-ink-muted">
          Ми надіслали лист для підтвердження на <b className="text-ink">{email}</b>. Відкрийте його й
          натисніть на посилання — і зможете увійти.
        </p>
        <Button variant="secondary" onClick={() => switchMode("signin")} className="mt-6">
          Повернутися до входу
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 bg-canvas px-6 py-16">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-[15px] font-bold text-ink-muted transition-colors hover:text-ink">
          ← На головну
        </Link>
        <Wordmark />
      </div>

      <div className="flex rounded-full bg-sunken p-[5px]">
        <button
          type="button"
          onClick={() => switchMode("signin")}
          className={`flex-1 rounded-full py-3 text-[16px] font-bold transition-colors ${
            !isSignup ? "bg-surface text-ink shadow-card" : "text-ink-muted"
          }`}
        >
          Увійти
        </button>
        <button
          type="button"
          onClick={() => switchMode("signup")}
          className={`flex-1 rounded-full py-3 text-[16px] font-bold transition-colors ${
            isSignup ? "bg-surface text-ink shadow-card" : "text-ink-muted"
          }`}
        >
          Зареєструватися
        </button>
      </div>

      <div>
        <h1 className="font-brand text-[24px] font-medium text-ink">
          {isSignup ? "Реєстрація" : "Вхід"}
        </h1>
        <p className="mt-2 text-[16px] text-ink-muted">
          {isSignup
            ? "Створіть обліковий запис, щоб керувати своїми сайтами."
            : "Раді вас бачити знову!"}
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <Field label="Електронна пошта">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ваш@email.com"
            autoComplete="email"
            required
          />
        </Field>

        <Field label="Пароль">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isSignup ? "Мінімум 6 символів" : "Ваш пароль"}
            autoComplete={isSignup ? "new-password" : "current-password"}
            required
          />
        </Field>

        {error && (
          <p className="rounded-[14px] bg-danger-soft px-4 py-3.5 text-[15px] font-semibold text-danger">
            {error}
          </p>
        )}

        <Button type="submit" disabled={loading} className="mt-2 w-full">
          {loading ? "Зачекайте…" : isSignup ? "Зареєструватися" : "Увійти"}
        </Button>
      </form>
    </main>
  );
}
