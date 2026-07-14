import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { isAuthConfigured, getUser } from "@/lib/supabase/auth";

/**
 * Guard for the management surfaces (§3.1). Route group (protected) leaves URLs
 * unchanged — /sites, /leads, /edit/* still resolve through the middleware
 * rewrite. Onboarding (/new) and the dashboard home stay OUTSIDE this group,
 * so they remain public.
 *
 * Chrome lives in the inner (shell) group (sidebar/topbar via AppShell); the
 * editor sits outside (shell) and brings its own chrome. This layout is the
 * auth gate only.
 *
 * Degradation invariant: with no auth configured we render children as-is (no
 * login wall) — identical to the pre-auth dashboard.
 */
export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  if (!isAuthConfigured()) return <>{children}</>;

  const user = await getUser();
  if (!user) redirect("/login");

  return <>{children}</>;
}
