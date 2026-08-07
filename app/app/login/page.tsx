"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Lock, Mail, MailCheck, Sparkles } from "lucide-react";
import {
  confirmedContinueAction,
  resendConfirmationAction,
  signInAction,
  signInWithGoogleAction,
  signUpAction,
} from "./actions";
import { Button, Field, Input } from "@/components/ui";
import { AuthShell, GoogleIcon } from "@/components/auth/AuthShell";
import { convFromNext, OAUTH_RESUME_KEY } from "@/components/onboard/embed-helpers";
import { phCapture } from "@/components/analytics/PostHogProvider";

/**
 * Auth page for the dashboard host (public path /login). One screen, two modes
 * («Увійти» / «Зареєструватися»), split-panel on desktop via AuthShell (form
 * left, brand right). Plain-language errors. On success the server action
 * redirects to /sites (or ?next=, when present and same-origin); here we only
 * surface errors and the "confirm your email" state.
 *
 * Landing-chat gate handoff (W2):
 *  - `?next=/new?conv=…` (a conversation handoff) defaults the page to the
 *    «Реєстрація» mode — the gate audience is new users; the toggle stays.
 *  - `?biz=<name>` renders a display-only context line («Сайт для … майже
 *    готовий») — never a data source, just reassurance nothing was lost.
 *  - `?google=1` pre-focuses the Google button: the chat's gate on the
 *    MARKETING root cannot call the server action itself (the action would
 *    run on the root origin and write the PKCE verifier cookie there, while
 *    /auth/callback lives on the app host — the exchange would fail), so the
 *    gate links here and THIS host starts the OAuth round-trip — on an
 *    EXPLICIT click. Auto-firing OAuth from a URL parameter was a login-CSRF
 *    vector (security review): any link could silently push a visitor with a
 *    consented Google session through sign-in onto an attacker-chosen `next`.
 *  - Before redirecting to Google we stamp sessionStorage[OAUTH_RESUME_KEY]
 *    with the conversation id (M12): only the same-tab OAuth return may
 *    auto-start generation on /new.
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
  // The `next` carries a conversation handoff → this visitor came from the
  // chat gate: default to «Реєстрація» (gate audience = new users).
  const handoffConv = convFromNext(next);
  // Display-only reassurance (plan §3.3) — NEVER a data source.
  const biz = (searchParams.get("biz") ?? "").trim().slice(0, 60);

  // The gate signals «new user» either way — via the conv handoff OR via the
  // `biz` context card (its no-conversation branch links with biz only, and a
  // «Створіть акаунт» card above a sign-in form contradicts itself).
  const [mode, setMode] = useState<Mode>(handoffConv || biz ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const errorParam = searchParams.get("error");
  const [error, setError] = useState(
    // /auth/callback bounces here on failure: `oauth` = genuine provider
    // cancel/misfire; `auth` = the code exchange failed (typically the signup
    // confirmation link opened in a browser without the PKCE verifier cookie
    // — a mail-app browser or another device), so the copy must not blame
    // Google and must reassure that nothing was lost.
    errorParam === "oauth"
      ? "Не вдалося увійти через Google. Спробуйте ще раз або скористайтесь поштою."
      : errorParam === "auth"
        ? "Посилання не спрацювало в цьому браузері. Увійдіть тут — розмова збережена."
        : "",
  );
  const [confirmSent, setConfirmSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  // M8 states for the «Перевірте пошту» screen.
  const [continueError, setContinueError] = useState("");
  const [continueLoading, setContinueLoading] = useState(false);
  const [resendNote, setResendNote] = useState("");
  const [resendLoading, setResendLoading] = useState(false);

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
    // Belt-and-braces for the email branch (review must-fix): the conversation
    // id must survive even if the Redirect Allow List drops `next` (GoTrue
    // silently falls back to SITE_URL). We are ON the app origin here — stamp
    // localStorage so /new can resume from its fallback after a next-less
    // landing on /sites.
    if (handoffConv) {
      try {
        localStorage.setItem("vitryna_conv_id", handoffConv);
      } catch {
        /* storage blocked — the `next` handoff still carries the id */
      }
    }
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
    // M12: stamp the same-tab OAuth resume flag BEFORE the redirect — /new
    // consumes it to distinguish «same tab, straight back from Google» (auto-
    // start generation) from a bearer-link visit (recap + button, no token burn).
    if (handoffConv) {
      try {
        sessionStorage.setItem(OAUTH_RESUME_KEY, handoffConv);
      } catch {
        /* storage blocked — /new degrades to the recap + button path */
      }
    }
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

  // ?google=1 (the chat gate's Google button, M7): the gate cannot call the
  // OAuth server action cross-host (see the page doc comment), so it links
  // here. NO auto-fire — starting an OAuth round-trip from a URL parameter
  // with no user gesture is login-CSRF (security review must-fix); instead
  // the Google button below is autofocused, keeping the same one-click code
  // path and the cross-host PKCE fix intact.
  const googleRequested = searchParams.get("google") === "1";

  // M8: «Я підтвердив — продовжити» — re-check the session server-side; on
  // success the action redirects (throws NEXT_REDIRECT) straight to `next`.
  const handleConfirmedContinue = async () => {
    if (continueLoading) return;
    setContinueError("");
    setResendNote("");
    setContinueLoading(true);
    try {
      const result = await confirmedContinueAction(next);
      if (result?.error) setContinueError(result.error);
    } catch (err) {
      if (err && typeof err === "object" && "digest" in err) throw err;
      setContinueError("Щось пішло не так. Спробуйте ще раз.");
    } finally {
      setContinueLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendLoading) return;
    setContinueError("");
    setResendNote("");
    setResendLoading(true);
    try {
      const result = await resendConfirmationAction(email, next);
      if ("error" in result) setContinueError(result.error);
      else setResendNote("Надіслали лист ще раз — перевірте пошту (і папку «Спам»).");
    } catch {
      setContinueError("Щось пішло не так. Спробуйте ще раз.");
    } finally {
      setResendLoading(false);
    }
  };

  if (confirmSent) {
    // M8: the post-signup screen must keep the gate flow alive — the letter
    // opens in another tab, so THIS tab offers «я підтвердив» (session
    // re-check → redirect to `next`) and a resend. PKCE note: the link only
    // works in the browser where the signup happened.
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
          в цьому ж браузері й натисніть на посилання.
        </p>
        {handoffConv && (
          <p className="animate-rise mt-3 rounded-2xl bg-honey-soft px-4 py-3 text-[15px] font-semibold text-honey-text">
            Розмова збережена — після підтвердження продовжите з того самого місця.
          </p>
        )}
        {continueError && (
          <p className="animate-rise mt-3 rounded-2xl bg-danger-soft px-4 py-3 text-[15px] font-semibold text-danger">
            {continueError}
          </p>
        )}
        {resendNote && (
          <p className="animate-rise mt-3 rounded-2xl bg-ok-soft px-4 py-3 text-[15px] font-semibold text-ok">
            {resendNote}
          </p>
        )}
        <Button
          size="lg"
          disabled={continueLoading}
          onClick={() => void handleConfirmedContinue()}
          className="mt-6 w-full rounded-full"
        >
          {continueLoading ? "Перевіряю…" : "Я підтвердив — продовжити"}
        </Button>
        <Button
          variant="secondary"
          disabled={resendLoading}
          onClick={() => void handleResend()}
          className="mt-2 w-full rounded-full"
        >
          {resendLoading ? "Надсилаю…" : "Надіслати лист ще раз"}
        </Button>
        <Button
          variant="quiet"
          onClick={() => switchMode("signin")}
          className="mt-2 rounded-full"
        >
          Повернутися до входу
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      {/* Context block (plan §3.3): the gate handed over a business name —
          show the visitor nothing was lost. Display-only. */}
      {biz && (
        <div className="animate-rise mb-4 flex items-center gap-2.5 rounded-2xl bg-honey-soft px-4 py-3.5">
          <Sparkles size={18} className="shrink-0 text-honey-text" aria-hidden />
          <p className="text-[15px] font-semibold leading-snug text-honey-text">
            Сайт для «{biz}» майже готовий. Створіть акаунт, щоб зберегти його.
          </p>
        </div>
      )}
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
          // ?google=1 = the gate's Google intent — pre-focus, never auto-fire.
          autoFocus={googleRequested}
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
