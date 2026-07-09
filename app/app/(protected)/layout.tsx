import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAuthConfigured, getUser } from "@/lib/supabase/auth";
import { isPlatformAdmin } from "@/lib/admin";
import { signOutAction } from "@/app/app/login/actions";

/**
 * Guard for the management surfaces (§3.1). Route group (protected) leaves URLs
 * unchanged — /sites, /leads, /edit/* still resolve through the middleware
 * rewrite. Onboarding (/new) and the dashboard home stay OUTSIDE this group,
 * so they remain public.
 *
 * Degradation invariant: with no auth configured we render children as-is (no
 * login wall) — identical to the pre-auth dashboard.
 */
export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  if (!isAuthConfigured()) return <>{children}</>;

  const user = await getUser();
  if (!user) redirect("/login");
  const admin = await isPlatformAdmin();

  return (
    <>
      <div className="flex items-center justify-between gap-4 border-b border-line bg-surface px-6 py-3.5">
        <div className="flex items-center gap-4">
          {admin && (
            <Link
              href="/admin"
              className="text-[15px] font-bold text-ink-muted transition-colors hover:text-ink"
            >
              Адмінка
            </Link>
          )}
          <span className="truncate text-[15px] font-semibold text-ink-muted">{user.email}</span>
        </div>
        <form action={signOutAction}>
          <button
            type="submit"
            className="text-[15px] font-bold text-ink-muted transition-colors hover:text-ink"
          >
            Вийти
          </button>
        </form>
      </div>
      {children}
    </>
  );
}
