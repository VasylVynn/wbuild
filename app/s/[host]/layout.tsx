import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getTenantByHost, getNav } from "@/lib/tenant/data";
import { themeToCssVars } from "@/lib/theme/tokens";
import { TENANT_FONT_CLASSES } from "@/lib/theme/fonts";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Beacon } from "@/components/site/Beacon";

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

  // A TEMPLATE site brings its OWN chrome (Nav + Footer) and palette via the
  // template wrapper inside PageRenderer. The shell must NOT add its default
  // header/footer or theme-vars background, or they'd DUPLICATE the template's
  // and clash. Pack/legacy sites keep the shared shell.
  const isTemplate = Boolean(tenant.brand.templateId);

  // Font variables ride on BOTH branches (design-DNA wave 1): the classic
  // shell resolves --font-heading/--font-body against them now; template
  // bundles will reference them in DNA wave 2. preload:false → a tenant
  // downloads only the families its applied CSS actually uses.
  if (isTemplate) {
    return (
      <div className={`flex min-h-screen flex-col ${TENANT_FONT_CLASSES}`}>
        <main className="flex-1">{children}</main>
        <Beacon />
      </div>
    );
  }

  return (
    <div
      style={{
        ...themeToCssVars(tenant.theme),
        backgroundColor: "var(--color-background)",
        color: "var(--color-foreground)",
        fontFamily: "var(--font-body)",
      }}
      className={`flex min-h-screen flex-col ${TENANT_FONT_CLASSES}`}
    >
      <SiteHeader tenant={tenant} nav={nav} />
      <main className="flex-1">{children}</main>
      <SiteFooter tenant={tenant} />
      <Beacon />
    </div>
  );
}
