"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, MailCheck } from "lucide-react";
import { resetPasswordAction } from "@/app/app/login/actions";
import { Button, Field, Input } from "@/components/ui";
import { AuthShell } from "@/components/auth/AuthShell";

/**
 * Password reset, step 1 (public path /reset on the app host): ask for the
 * email, send the recovery link. The link lands on /reset/confirm. Rendered
 * in the shared AuthShell so desktop gets the same split-panel as /login.
 */

const backToLogin = (
  <Link
    href="/login"
    className="text-[14px] font-semibold text-ink-muted transition-colors hover:text-ink"
  >
    ← До входу
  </Link>
);

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
      <AuthShell centered footer={backToLogin}>
        <div className="animate-pop mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-full bg-honey-soft text-honey-text">
          <MailCheck size={32} />
        </div>
        <h1 className="animate-rise mt-6 font-brand text-[26px] font-semibold text-ink">
          Перевірте пошту
        </h1>
        <p className="animate-rise mt-2 text-[16px] leading-relaxed text-ink-muted">
          Якщо акаунт із адресою <b className="text-ink">{email}</b> існує, ми надіслали лист із
          посиланням для зміни пароля. Відкрийте його в цьому ж браузері.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block text-[14px] font-semibold text-ink-muted transition-colors hover:text-ink"
        >
          ← Повернутися до входу
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell footer={backToLogin}>
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
    </AuthShell>
  );
}
