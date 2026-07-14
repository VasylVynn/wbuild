import type { ReactNode } from "react";
import { isAuthConfigured, getUser } from "@/lib/supabase/auth";
import { isPlatformAdmin } from "@/lib/admin";
import { signOutAction } from "@/app/app/login/actions";
import AppShell from "@/components/dashboard/AppShell";

/**
 * Management chrome (P1): every page in this group renders inside AppShell
 * (desktop sidebar / mobile top bar). Auth is already enforced by the outer
 * (protected) layout; here we only fetch what the chrome displays.
 */
export default async function ShellLayout({ children }: { children: ReactNode }) {
  const user = isAuthConfigured() ? await getUser() : null;
  const admin = await isPlatformAdmin();

  return (
    <AppShell email={user?.email ?? null} admin={admin} signOut={signOutAction}>
      {children}
    </AppShell>
  );
}
