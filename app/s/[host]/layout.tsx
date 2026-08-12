import type { ReactNode } from "react";
import type { Viewport } from "next";
import { notFound } from "next/navigation";
import { getTenantByHost } from "@/lib/tenant/data";
import { getCachedPublishedPage } from "@/lib/cache";
import { Beacon } from "@/components/site/Beacon";

/** A palette bg from the S1 design brief is a literal #rrggbb (design-spec
 *  schema) — anything else (draft absent, v1 fallback, malformed value) falls
 *  back to the root layout's default instead of shipping a wrong colour. */
const HEX_BG = /^#[0-9a-f]{6}$/i;

/**
 * The browser-chrome theme colour follows the SITE's own background — the
 * root layout's static #f7f0e0 made dark-themed sites show a cream mobile
 * address bar, a mismatch visible on every dark regen (owner audit
 * 2026-08-12: «сайти майже однакові» was partly this — the chrome never
 * changed with the design). Reads the same cached published home page the
 * renderer uses, so a regenerated draft cannot restyle the live site.
 */
export async function generateViewport({
  params,
}: {
  params: Promise<{ host: string }>;
}): Promise<Viewport> {
  const { host } = await params;
  try {
    const page = await getCachedPublishedPage(host, "");
    const bg = page?.designSpec?.palette.bg;
    if (bg && HEX_BG.test(bg)) {
      return { themeColor: bg, colorScheme: "light" };
    }
  } catch {
    // A viewport must never take the page down — fall through to defaults.
  }
  return { colorScheme: "light" };
}

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
    <div className="flex min-h-screen flex-col">
      <main className="flex-1">{children}</main>
      <Beacon />
    </div>
  );
}
