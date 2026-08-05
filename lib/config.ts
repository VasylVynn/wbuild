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

/** Dev root domains that run on plain http with an explicit port. */
const DEV_ROOTS = ["lvh.me", "localhost", "127.0.0.1"];

/**
 * The ONE public URL builder for a tenant host — every user-facing «Відкрити
 * сайт» link goes through this. Dev roots (lvh.me/localhost) get http + the
 * ROOT_DOMAIN port; everything else is https with no port. Client-safe
 * (ROOT_DOMAIN is NEXT_PUBLIC_*, inlined at build time).
 */
export function publicSiteUrl(host: string): string {
  const bare = stripPort(host);
  const isDev = DEV_ROOTS.some((r) => bare === r || bare.endsWith(`.${r}`));
  if (!isDev) return `https://${bare}`;
  const port = ROOT_DOMAIN.split(":")[1];
  return `http://${bare}${port ? `:${port}` : ""}`;
}

/**
 * Absolute URL for a page that lives on the MARKETING ROOT (/oferta, /privacy).
 * The dashboard host has no such routes — middleware rewrites every path there
 * into the /app namespace, so a bare href="/oferta" from the editor or the
 * onboarding chat resolves to /app/oferta and 404s. Same dev/prod protocol rule
 * as publicSiteUrl, and client-safe for the same reason.
 */
export function rootSiteUrl(path = "/"): string {
  return `${publicSiteUrl(ROOT_DOMAIN)}${path}`;
}

/** Subdomain labels reserved for the platform itself (never tenants). */
const PLATFORM_SUBDOMAINS = ["www", "app"] as const;

export function stripPort(host: string): string {
  return host.split(":")[0];
}

function rootHost(): string {
  return stripPort(ROOT_DOMAIN);
}

/**
 * Additional platform ROOT domains during the brand migration overlap
 * (wizz-app.net primary while 3minsite.com.ua comes online, or vice versa).
 * Comma-separated bare domains. Every listed root serves the marketing page,
 * its `www.` variant, and its `app.` dashboard — WITHOUT it, an added Vercel
 * domain falls through to the tenant branch and 404s (no tenant has that
 * host). ROOT_DOMAIN stays the single source for URL BUILDING
 * (publicSiteUrl/rootSiteUrl) and for minting new tenant subdomains.
 */
function extraPlatformRoots(): string[] {
  return (process.env.NEXT_PUBLIC_EXTRA_PLATFORM_ROOTS ?? "")
    .split(",")
    .map((s) => stripPort(s.trim()).toLowerCase())
    .filter(Boolean);
}

function platformRoots(): string[] {
  return [rootHost(), ...extraPlatformRoots()];
}

/** True for the marketing root and platform subdomains (www, app) of ANY platform root. */
export function isPlatformHost(host: string): boolean {
  const h = stripPort(host);
  if (!h) return true; // no host → treat as platform (serves marketing)
  for (const root of platformRoots()) {
    if (h === root) return true;
    if (h.endsWith(`.${root}`)) {
      const label = h.slice(0, -(root.length + 1));
      if ((PLATFORM_SUBDOMAINS as readonly string[]).includes(label)) return true;
    }
  }
  return false; // custom domains are tenants, not platform
}

/** True for the dashboard/editor host (`app.<root>`) of ANY platform root. */
export function isDashboardHost(host: string): boolean {
  const h = stripPort(host);
  return platformRoots().some((root) => h === `app.${root}`);
}
