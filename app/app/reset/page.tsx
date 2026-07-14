"use client";

import { useState } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { resetPasswordAction } from "@/app/app/login/actions";
import { Button, Field, Input, Wordmark } from "@/components/ui";

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
        <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-honey-soft text-honey-text">
          <MailCheck size={32} />
        </div>
        <h1 className="mt-6 font-brand text-[24px] font-medium text-ink">Перевірте пошту</h1>
        <p className="text-[16px] leading-relaxed text-ink-muted">
          Якщо акаунт із адресою <b className="text-ink">{email}</b> існує, ми надіслали лист із
          посиланням для зміни пароля. Відкрийте його в цьому ж браузері.
        </p>
        <Link href="/login" className="mt-6 text-[14px] font-semibold text-brand hover:text-brand-hover">
          ← Повернутися до входу
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 bg-canvas px-6 py-16">
      <div className="flex items-center justify-between">
        <Link href="/login" className="text-[14px] font-semibold text-ink-muted transition-colors hover:text-ink">
          ← До входу
        </Link>
        <Wordmark />
      </div>

      <div>
        <h1 className="font-brand text-[24px] font-medium text-ink">Скидання пароля</h1>
        <p className="mt-2 text-[15px] text-ink-muted">
          Введіть email, з яким реєструвалися, — надішлемо посилання для зміни пароля.
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

        {error && (
          <p className="rounded-[12px] bg-danger-soft px-4 py-3 text-[14px] font-semibold text-danger">{error}</p>
        )}

        <Button type="submit" disabled={loading} className="mt-2 w-full">
          {loading ? "Зачекайте…" : "Надіслати лист"}
        </Button>
      </form>
    </main>
  );
}
