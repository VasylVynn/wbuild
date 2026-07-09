import "server-only";
import { isAuthConfigured, getUser } from "@/lib/supabase/auth";

/**
 * Platform-admin gate (founders-only overview + kill-switch). FAIL-CLOSED by
 * construction: with auth off, no user, or no email, this returns false — the
 * caller (an admin page/action) must treat that as "not an admin", never as
 * "degrade to open" the way the tenant-ownership gates do (§3.1 pattern does
 * NOT apply here — there is no safe "everyone can see the admin panel").
 *
 * Allowlist is env-only (ADMIN_EMAILS, comma-separated), never a DB flag —
 * so a compromised row can't grant platform access.
 */
export async function isPlatformAdmin(): Promise<boolean> {
  if (!isAuthConfigured()) return false;

  const user = await getUser();
  if (!user?.email) return false;

  const allowlist = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (allowlist.length === 0) return false;

  return allowlist.includes(user.email.trim().toLowerCase());
}
