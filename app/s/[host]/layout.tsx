import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getTenantByHost } from "@/lib/tenant/data";
import { TENANT_FONT_CLASSES } from "@/lib/fonts";
import { Beacon } from "@/components/site/Beacon";

/**
 * Tenant shell (brief §5.1). Every site is a wireframe site: its header, footer
 * and entire visual surface come from the template wrapper inside PageRenderer,
 * styled by the stylesheet generated for that tenant. The shell therefore adds
 * nothing but the font registrations and the analytics beacon — anything more
 * would duplicate or fight the site's own chrome.
 */
export default async function TenantLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ host: string }>;
}) {
  const { host } = await params;
  // The only thing the shell needs from the tenant is whether it exists and is
  // visible (getTenantByHost drops suspended rows).
  const tenant = await getTenantByHost(host);
  if (!tenant) notFound();

  return (
    <div className={`flex min-h-screen flex-col ${TENANT_FONT_CLASSES}`}>
      <main className="flex-1">{children}</main>
      <Beacon />
    </div>
  );
}
