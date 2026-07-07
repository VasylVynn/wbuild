import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getTenantByHost, getNav } from "@/lib/tenant/data";
import { themeToCssVars } from "@/lib/theme/tokens";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";

/**
 * Tenant shell (brief §5.1): applies the tenant's design tokens as CSS
 * variables, then wraps every tenant page with the shared header/footer/nav.
 * Header/footer/nav are NOT part of any page — they live at the tenant level.
 */
export default async function TenantLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ host: string }>;
}) {
  const { host } = await params;
  const [tenant, nav] = await Promise.all([getTenantByHost(host), getNav(host)]);
  if (!tenant) notFound();

  return (
    <div
      style={{
        ...themeToCssVars(tenant.theme),
        backgroundColor: "var(--color-background)",
        color: "var(--color-foreground)",
        fontFamily: "var(--font-body)",
      }}
      className="flex min-h-screen flex-col"
    >
      <SiteHeader tenant={tenant} nav={nav} />
      <main className="flex-1">{children}</main>
      <SiteFooter tenant={tenant} />
    </div>
  );
}
