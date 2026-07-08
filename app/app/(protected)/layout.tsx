import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { isAuthConfigured, getUser } from "@/lib/supabase/auth";
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

  return (
    <>
      <div className="flex items-center justify-between gap-4 border-b border-neutral-200 bg-white px-6 py-3">
        <span className="truncate text-sm text-neutral-600">{user.email}</span>
        <form action={signOutAction}>
          <button
            type="submit"
            className="rounded-full border border-neutral-300 px-4 py-1.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
          >
            Вийти
          </button>
        </form>
      </div>
      {children}
    </>
  );
}
