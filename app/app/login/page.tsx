"use client";

import { useState } from "react";
import Link from "next/link";
import { signInAction, signUpAction } from "./actions";

/**
 * Auth page for the dashboard host (public path /login). One screen, two modes
 * («Увійти» / «Зареєструватися»). Big touch targets and plain-language errors
 * for a non-technical 50+ audience. On success the server action redirects to
 * /sites; here we only surface errors and the "confirm your email" state.
 */
type Mode = "signin" | "signup";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [confirmSent, setConfirmSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const isSignup = mode === "signup";

  const switchMode = (next: Mode) => {
    setMode(next);
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
        ? await signUpAction(email, password)
        : await signInAction(email, password);
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
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-16 text-center">
        <div className="text-6xl">📬</div>
        <h1 className="mt-6 text-2xl font-bold text-neutral-900">Перевірте пошту</h1>
        <p className="mt-3 text-lg leading-relaxed text-neutral-600">
          Ми надіслали лист для підтвердження на <b>{email}</b>. Відкрийте його й
          натисніть на посилання — і зможете увійти.
        </p>
        <button
          onClick={() => switchMode("signin")}
          className="mt-8 text-base font-medium text-neutral-800 underline underline-offset-4"
        >
          Повернутися до входу
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-800">
        ← На головну
      </Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-neutral-900">
        {isSignup ? "Реєстрація" : "Вхід"}
      </h1>
      <p className="mt-2 text-lg text-neutral-600">
        {isSignup
          ? "Створіть обліковий запис, щоб керувати своїми сайтами."
          : "Раді вас бачити знову!"}
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-8 flex flex-col gap-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-neutral-700">Електронна пошта</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ваш@email.com"
            autoComplete="email"
            required
            className="min-h-14 w-full rounded-2xl border border-neutral-200 bg-white px-5 py-4 text-base text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-300"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-neutral-700">Пароль</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isSignup ? "Мінімум 6 символів" : "Ваш пароль"}
            autoComplete={isSignup ? "new-password" : "current-password"}
            required
            className="min-h-14 w-full rounded-2xl border border-neutral-200 bg-white px-5 py-4 text-base text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-300"
          />
        </label>

        {error && (
          <p className="rounded-2xl bg-red-50 px-5 py-4 text-base text-red-600">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 w-full rounded-2xl bg-neutral-800 py-5 text-xl font-semibold text-white transition-all hover:bg-neutral-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Зачекайте…" : isSignup ? "Зареєструватися" : "Увійти"}
        </button>
      </form>

      <p className="mt-8 text-center text-base text-neutral-600">
        {isSignup ? "Вже маєте обліковий запис? " : "Ще не з нами? "}
        <button
          type="button"
          onClick={() => switchMode(isSignup ? "signin" : "signup")}
          className="font-semibold text-neutral-900 underline underline-offset-4"
        >
          {isSignup ? "Увійти" : "Зареєструватися"}
        </button>
      </p>
    </main>
  );
}
