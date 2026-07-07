/**
 * Reserved subdomain labels — never assignable as a tenant host (§5.1.1).
 * Enforced in app-level validation at tenant creation; the DB also has a
 * UNIQUE(host) constraint. Keep in sync with platform subdomains in config.ts.
 */
export const RESERVED_SUBDOMAINS = new Set<string>([
  "www",
  "app",
  "api",
  "admin",
  "dashboard",
  "cdn",
  "static",
  "assets",
  "img",
  "images",
  "mail",
  "smtp",
  "ftp",
  "ns1",
  "ns2",
  "blog",
  "help",
  "support",
  "status",
  "docs",
  "sitemap",
  "robots",
  "vitryna",
  "_next",
]);

export function isReservedSubdomain(label: string): boolean {
  return RESERVED_SUBDOMAINS.has(label.trim().toLowerCase());
}
