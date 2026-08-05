import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Auth-plane Supabase client (§3.1): uses the ANON key + the caller's session
 * cookies, so RLS applies and auth.uid() is the signed-in user. Distinct from
 * server.ts's SERVICE-ROLE client (public render / privileged writes).
 *
 * Graceful degradation: with no url+anon key the whole auth layer is OFF and
 * every guard treats the app as open (behaves exactly as before auth landed).
 */
/**
 * The browser-safe Supabase key under EITHER of its dashboard names: the 2025
 * "publishable" key (sb_publishable_…) or the legacy "anon" JWT. Accepting both
 * matters because a missing key doesn't fail loudly — it silently switches the
 * whole auth layer OFF (degrade-open, §3.1), so an env built from the other
 * dashboard wording would ship production with every ownership gate open.
 */
function publicSupabaseKey(): string | undefined {
  // `||`, not `??`: an env file with a blank `NEXT_PUBLIC_SUPABASE_ANON_KEY=`
  // line yields "" (defined), which must still fall through to the other name.
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    undefined
  );
}

export function isAuthConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && publicSupabaseKey());
}

/**
 * Cookie-wired SSR client. cookies() is async in Next 15 — await it once and
 * hand createServerClient getAll/setAll over the store. setAll THROWS when
 * called from a Server Component (read-only cookies); that's expected and
 * swallowed — sign-in/out run in Server Actions where the write succeeds.
 */
export async function getAuthClient(): Promise<SupabaseClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = publicSupabaseKey();
  if (!url || !key) {
    throw new Error(
      "Supabase auth not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)",
    );
  }
  const store = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            store.set(name, value, options);
          }
        } catch {
          // Server Component render context: cookies are read-only. Session
          // refresh is written by the login action instead — safe to ignore.
        }
      },
    },
  });
}

export interface AuthUser {
  id: string;
  email: string | null;
}

/** Current signed-in user, or null (unconfigured / anonymous). */
export async function getUser(): Promise<AuthUser | null> {
  if (!isAuthConfigured()) return null;
  const sb = await getAuthClient();
  const { data, error } = await sb.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}
