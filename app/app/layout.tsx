import type { ReactNode } from "react";
import { PostHogProvider } from "@/components/analytics/PostHogProvider";

/**
 * Analytics boundary for the whole dashboard namespace — login, reset, /new,
 * pay, sites, editor, admin. It exists only so PostHog covers every management
 * screen from one mount instead of the root layout, which tenant sites share
 * (see components/analytics/PostHogProvider.tsx).
 *
 * Pure passthrough: no markup, no styling, no chrome. Chrome still belongs to
 * (shell); the auth gate still belongs to (protected).
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <PostHogProvider>{children}</PostHogProvider>;
}
