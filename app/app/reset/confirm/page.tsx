"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Lock } from "lucide-react";
import { updatePasswordAction } from "@/app/app/login/actions";
import { Button, Field, Input } from "@/components/ui";
import { AuthShell } from "@/components/auth/AuthShell";

/**
 * Password reset, step 2 (public path /reset/confirm): the recovery email
 * lands here with ?code=…. The code→session exchange + password update run in
 * the server action on submit. Same AuthShell chrome as /login and /reset.
 */
export default function ResetConfirmPage() {
  // useSearchParams requires a Suspense boundary.
  return (
    <Suspense fallback={null}>
      <ResetConfirmForm />
    </Suspense>
  );
}

const backToLogin = (
  <Link
    href="/login"
    className="text-[14px] font-semibold text-ink-muted transition-colors hover:text-ink"
  >
    ← До входу
  </Link>
);

function ResetConfirmForm() {
  const searchParams = useSearchParams();
  const code = searchParams.get("code");

  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (password !== repeat) {
      setError("Паролі не збігаються.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const result = await updatePasswordAction(code, password);
      // On success the action redirects (throws NEXT_REDIRECT).
      if (result?.error) setError(result.error);
    } catch (err) {
      if (err && typeof err === "object" && "digest" in err) throw err;
      setError("Щось пішло не так. Спробуйте ще раз.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell footer={backToLogin}>
      <div className="animate-rise">
        <h1 className="text-balance font-brand text-[28px] font-semibold tracking-tight text-ink">
          Новий пароль
        </h1>
        <p className="mt-2 text-[15px] text-ink-muted">Придумайте новий пароль для входу.</p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="animate-rise mt-6 flex flex-col gap-4">
        <Field label="Новий пароль">
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
              placeholder="Мінімум 6 символів"
              autoComplete="new-password"
              required
              className="pl-10"
            />
          </div>
        </Field>

        <Field label="Повторіть пароль">
          <div className="relative">
            <Lock
              aria-hidden
              size={16}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint"
            />
            <Input
              type="password"
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
              placeholder="Ще раз той самий пароль"
              autoComplete="new-password"
              required
              className="pl-10"
            />
          </div>
        </Field>

        {error && (
          <div className="flex flex-col gap-2 rounded-2xl bg-danger-soft px-4 py-3 text-[14px] font-semibold text-danger">
            {error}
            <Link href="/reset" className="font-semibold underline">
              Надіслати новий лист
            </Link>
          </div>
        )}

        <Button type="submit" size="lg" disabled={loading} className="mt-2 w-full rounded-full">
          {loading ? "Зачекайте…" : "Зберегти пароль"}
        </Button>
      </form>
    </AuthShell>
  );
}
