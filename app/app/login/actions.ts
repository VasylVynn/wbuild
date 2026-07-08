"use server";

import { redirect } from "next/navigation";
import { isAuthConfigured, getAuthClient } from "@/lib/supabase/auth";

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

export async function signInAction(email: string, password: string): Promise<SignInResult> {
  if (!isAuthConfigured()) return { error: "Вхід тимчасово недоступний." };
  const creds = normalize(email, password);
  if (!creds) return { error: "Введіть email і пароль." };

  const sb = await getAuthClient();
  const { error } = await sb.auth.signInWithPassword(creds);
  if (error) return { error: uaError(error.message) };

  redirect("/sites");
}

export async function signUpAction(email: string, password: string): Promise<SignUpResult> {
  if (!isAuthConfigured()) return { error: "Реєстрація тимчасово недоступна." };
  const creds = normalize(email, password);
  if (!creds) return { error: "Введіть email і пароль." };
  if (creds.password.length < 6) return { error: "Пароль має містити щонайменше 6 символів." };

  const sb = await getAuthClient();
  const { data, error } = await sb.auth.signUp(creds);
  if (error) return { error: uaError(error.message) };

  // "Confirm email" is ON in the project → no session yet. Ask the user to
  // check their inbox instead of pretending they are signed in.
  if (!data.session) return { needsConfirmation: true };

  redirect("/sites");
}

export async function signOutAction(): Promise<void> {
  if (isAuthConfigured()) {
    const sb = await getAuthClient();
    await sb.auth.signOut();
  }
  redirect("/login");
}
