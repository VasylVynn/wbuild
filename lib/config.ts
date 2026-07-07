/**
 * Platform vs tenant host resolution (brief §2.5).
 *
 * ONE app serves two worlds:
 *   - Platform hosts: the marketing root and the `app.` dashboard.
 *   - Tenant hosts: every subdomain (and, later, custom domains).
 *
 * Root domain is configurable so local dev uses `lvh.me` (a public DNS name
 * that resolves *.lvh.me → 127.0.0.1) instead of buying a domain — the wildcard
 * subdomain model is validated locally with real Host headers.
 */

export const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "lvh.me:3000";

/** Subdomain labels reserved for the platform itself (never tenants). */
const PLATFORM_SUBDOMAINS = ["www", "app"] as const;

export function stripPort(host: string): string {
  return host.split(":")[0];
}

function rootHost(): string {
  return stripPort(ROOT_DOMAIN);
}

/** True for the marketing root and platform subdomains (www, app). */
export function isPlatformHost(host: string): boolean {
  const h = stripPort(host);
  const root = rootHost();
  if (!h) return true; // no host → treat as platform (serves marketing)
  if (h === root) return true;
  if (h.endsWith(`.${root}`)) {
    const label = h.slice(0, -(root.length + 1));
    return (PLATFORM_SUBDOMAINS as readonly string[]).includes(label);
  }
  return false; // custom domains are tenants, not platform
}

/** True for the dashboard/editor host (`app.<root>`). */
export function isDashboardHost(host: string): boolean {
  return stripPort(host) === `app.${rootHost()}`;
}
