"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, MailCheck } from "lucide-react";
import { resetPasswordAction } from "@/app/app/login/actions";
import { Button, Field, Input } from "@/components/ui";
import { Logo } from "@/components/landing/Logo";

/**
 * Password reset, step 1 (public path /reset on the app host): ask for the
 * email, send the recovery link. The link lands on /reset/confirm.
 */
export default function ResetPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      const result = await resetPasswordAction(email);
      if ("sent" in result) setSent(true);
      else setError(result.error);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-2 bg-canvas px-6 py-16 text-center">
        <div className="animate-pop flex h-[72px] w-[72px] items-center justify-center rounded-full bg-honey-soft text-honey-text">
          <MailCheck size={32} />
        </div>
        <h1 className="animate-rise mt-6 font-brand text-[26px] font-semibold text-ink">
          Перевірте пошту
        </h1>
        <p className="animate-rise text-[16px] leading-relaxed text-ink-muted">
          Якщо акаунт із адресою <b className="text-ink">{email}</b> існує, ми надіслали лист із
          посиланням для зміни пароля. Відкрийте його в цьому ж браузері.
        </p>
        <Link
          href="/login"
          className="mt-6 text-[14px] font-semibold text-ink-muted transition-colors hover:text-ink"
        >
          ← Повернутися до входу
        </Link>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-canvas px-5 py-6 sm:px-10">
      <Logo href={process.env.NEXT_PUBLIC_ROOT_DOMAIN ? `//${process.env.NEXT_PUBLIC_ROOT_DOMAIN}` : "/"} />

      <div className="flex flex-1 items-center justify-center py-10">
        <div className="w-full max-w-sm">
          <div className="animate-rise">
            <h1 className="text-balance font-brand text-[28px] font-semibold tracking-tight text-ink">
              Скидання пароля
            </h1>
            <p className="mt-2 text-[15px] text-ink-muted">
              Введіть email, з яким реєструвалися, — надішлемо посилання для зміни пароля.
            </p>
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

            {error && (
              <p className="rounded-2xl bg-danger-soft px-4 py-3 text-[14px] font-semibold text-danger">
                {error}
              </p>
            )}

            <Button type="submit" size="lg" disabled={loading} className="mt-2 w-full rounded-full">
              {loading ? "Зачекайте…" : "Надіслати лист"}
            </Button>
          </form>
        </div>
      </div>

      <Link
        href="/login"
        className="text-[14px] font-semibold text-ink-muted transition-colors hover:text-ink"
      >
        ← До входу
      </Link>
    </main>
  );
}
