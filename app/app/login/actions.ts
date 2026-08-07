"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { isAuthConfigured, getAuthClient } from "@/lib/supabase/auth";
import { ROOT_DOMAIN, isDashboardHost, publicSiteUrl } from "@/lib/config";
import { safeNext } from "@/lib/auth/safe-next";

/**
 * Auth server actions (§3.1). Sign-in/up run here (not in the browser) so the
 * session cookies are written server-side via @supabase/ssr. On success we
 * redirect() to the PUBLIC path /sites — redirect throws NEXT_REDIRECT, so it
 * is called AFTER the supabase call and never inside a try/catch that would
 * swallow it.
 */

export type SignInResult = { error: string } | undefined;
export type SignUpResult =
  | { error: string }
  | { needsConfirmation: true }
  | undefined;

/** Map Supabase's English auth errors to warm Ukrainian copy. */
function uaError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Невірний email або пароль.";
  if (m.includes("email not confirmed"))
    return "Спочатку підтвердіть email — ми надіслали вам лист.";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "Цей email вже зареєстровано. Спробуйте увійти.";
  if (m.includes("password should be at least"))
    return "Пароль має містити щонайменше 6 символів.";
  if (m.includes("unable to validate email") || m.includes("invalid format"))
    return "Схоже, email введено з помилкою.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Забагато спроб. Спробуйте, будь ласка, трохи пізніше.";
  return "Щось пішло не так. Спробуйте ще раз.";
}

function normalize(email: string, password: string): { email: string; password: string } | null {
  const e = email.trim().toLowerCase();
  if (!e || !password) return null;
  return { email: e, password };
}

// safeNext (same-origin redirect guard) lives in lib/auth/safe-next — ONE
// hardened copy shared with app/app/auth/callback/route.ts.

export async function signInAction(email: string, password: string, next?: string): Promise<SignInResult> {
  if (!isAuthConfigured()) return { error: "Вхід тимчасово недоступний." };
  const creds = normalize(email, password);
  if (!creds) return { error: "Введіть email і пароль." };

  const sb = await getAuthClient();
  const { error } = await sb.auth.signInWithPassword(creds);
  if (error) return { error: uaError(error.message) };

  redirect(safeNext(next));
}

export async function signUpAction(email: string, password: string, next?: string): Promise<SignUpResult> {
  if (!isAuthConfigured()) return { error: "Реєстрація тимчасово недоступна." };
  const creds = normalize(email, password);
  if (!creds) return { error: "Введіть email і пароль." };
  if (creds.password.length < 6) return { error: "Пароль має містити щонайменше 6 символів." };

  const sb = await getAuthClient();
  // M2 (landing-chat plan §7): the confirmation email must land back on
  // /auth/callback WITH the `next` handoff (`/new?conv=…&resume=1`), or the
  // email branch guarantees losing the conversation. Same origin+encoding
  // contract as signInWithGoogleAction below — GoTrue carries this URL as
  // `redirect_to` (encoding it once more inside the email link, which is the
  // plan's «двічі-закодований» on the wire; in code we encode exactly once,
  // mirroring the proven OAuth path). The callback's safeNext copy unwraps it.
  // Ops note: this URL pattern must be in the Supabase Redirect Allow List.
  const { data, error } = await sb.auth.signUp({
    ...creds,
    options: { emailRedirectTo: await signupEmailRedirect(next) },
  });
  if (error) return { error: uaError(error.message) };

  // "Confirm email" is ON in the project → no session yet. Ask the user to
  // check their inbox instead of pretending they are signed in.
  if (!data.session) return { needsConfirmation: true };

  redirect(safeNext(next));
}

export async function signOutAction(): Promise<void> {
  if (isAuthConfigured()) {
    const sb = await getAuthClient();
    await sb.auth.signOut();
  }
  redirect("/login");
}

/**
 * Public origin of the dashboard host THE USER IS ON. During the brand-domain
 * overlap the dashboard answers on several `app.<root>` hosts — email links
 * (reset, OAuth callback) must land back on the same one, or the PKCE
 * verifier cookie set on host A is missing on host B and the code exchange
 * fails. The request Host is trusted only when it IS a known dashboard host
 * (isDashboardHost); anything else falls back to the primary root.
 */
async function appOrigin(): Promise<string> {
  const host = (await headers()).get("host") ?? "";
  if (isDashboardHost(host)) return publicSiteUrl(host);
  return publicSiteUrl(`app.${ROOT_DOMAIN}`);
}

/** The signup-confirmation landing URL (M2) — shared by signUpAction and the
 *  resend action so the re-sent email carries the exact same handoff. */
async function signupEmailRedirect(next?: string): Promise<string> {
  return `${await appOrigin()}/auth/callback?next=${encodeURIComponent(safeNext(next))}`;
}

export type ResetRequestResult = { error: string } | { sent: true };

export async function resetPasswordAction(email: string): Promise<ResetRequestResult> {
  if (!isAuthConfigured()) return { error: "Скидання пароля тимчасово недоступне." };
  const e = email.trim().toLowerCase();
  if (!e) return { error: "Введіть email." };

  const sb = await getAuthClient();
  const { error } = await sb.auth.resetPasswordForEmail(e, {
    redirectTo: `${await appOrigin()}/reset/confirm`,
  });
  if (error) return { error: uaError(error.message) };
  return { sent: true };
}

export type OAuthResult = { error: string } | undefined;

/**
 * Google sign-in via Supabase OAuth (PKCE). The action writes the verifier
 * cookie server-side and redirects the browser to Google; Supabase then lands
 * on /auth/callback?code=… (same dashboard host), where the route handler
 * exchanges the code for a session. Requires the Google provider to be
 * enabled in the Supabase dashboard — until then Supabase errors and the user
 * sees the Ukrainian fallback message.
 */
export async function signInWithGoogleAction(next?: string): Promise<OAuthResult> {
  if (!isAuthConfigured()) return { error: "Вхід тимчасово недоступний." };

  const sb = await getAuthClient();
  const origin = await appOrigin();
  const { data, error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(safeNext(next))}`,
      skipBrowserRedirect: true,
    },
  });
  if (error || !data?.url) {
    return { error: "Вхід через Google зараз недоступний. Спробуйте пошту і пароль." };
  }
  redirect(data.url);
}

export type ConfirmContinueResult = { error: string } | undefined;

/**
 * M8 («Я підтвердив — продовжити»): the post-signup screen re-checks the
 * session on click. Clicking the email link in ANOTHER TAB of the same browser
 * writes the session cookies browser-wide (the /auth/callback exchange), so
 * this tab sees them and can continue straight to `next`. No session yet →
 * an honest hint (PKCE: the link only works in the browser that signed up).
 */
export async function confirmedContinueAction(next?: string): Promise<ConfirmContinueResult> {
  if (!isAuthConfigured()) return { error: "Вхід тимчасово недоступний." };
  const sb = await getAuthClient();
  const { data, error } = await sb.auth.getUser();
  if (error || !data.user) {
    return {
      error:
        "Поки не бачу підтвердження. Відкрийте лист у цьому ж браузері, натисніть посилання — і поверніться сюди.",
    };
  }
  redirect(safeNext(next));
}

export type ResendConfirmResult = { error: string } | { sent: true };

/** M8: re-send the signup confirmation email — with the SAME `next` handoff. */
export async function resendConfirmationAction(
  email: string,
  next?: string,
): Promise<ResendConfirmResult> {
  if (!isAuthConfigured()) return { error: "Реєстрація тимчасово недоступна." };
  const e = email.trim().toLowerCase();
  if (!e) return { error: "Введіть email." };

  const sb = await getAuthClient();
  const { error } = await sb.auth.resend({
    type: "signup",
    email: e,
    options: { emailRedirectTo: await signupEmailRedirect(next) },
  });
  if (error) return { error: uaError(error.message) };
  return { sent: true };
}

export type UpdatePasswordResult = { error: string } | undefined;

/**
 * Second step of the reset flow: the email link lands on /reset/confirm?code=…
 * (PKCE — the verifier cookie was set by resetPasswordForEmail, so the link
 * must be opened in the same browser). The code→session exchange happens here,
 * in a Server Action, because only actions may write session cookies.
 */
export async function updatePasswordAction(code: string | null, password: string): Promise<UpdatePasswordResult> {
  if (!isAuthConfigured()) return { error: "Скидання пароля тимчасово недоступне." };
  if (password.length < 6) return { error: "Пароль має містити щонайменше 6 символів." };

  const sb = await getAuthClient();
  if (code) {
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (error)
      return {
        error:
          "Посилання застаріло або відкрите в іншому браузері. Запросіть новий лист і відкрийте його там само, де ввели email.",
      };
  }

  const { error } = await sb.auth.updateUser({ password });
  if (error) return { error: uaError(error.message) };

  redirect("/sites");
}
