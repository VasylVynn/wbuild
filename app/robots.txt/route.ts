import { headers } from "next/headers";
import { isDashboardHost, isPlatformHost, stripPort } from "@/lib/config";
import { getTenantByHost } from "@/lib/tenant/data";

/**
 * Per-host robots.txt (§5.2 / §10.4). Middleware lets /robots.txt through
 * untouched (never tenant-rewritten), so this handler resolves the tenant from
 * the Host header itself. Force-dynamic: the body varies by host, so it must
 * not be statically cached.
 */
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const host = stripPort((await headers()).get("host") ?? "");
  return new Response(await robotsBody(host), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

async function robotsBody(host: string): Promise<string> {
  // Dashboard (app.<root>) is a private admin surface — never index it.
  if (isDashboardHost(host)) return "User-agent: *\nDisallow: /\n";

  // Marketing root / www — indexable; no tenant sitemap belongs here (yet).
  if (isPlatformHost(host)) return "User-agent: *\nAllow: /\n";

  // Tenant: crawl only a PUBLISHED tenant — the crawler-level mirror of the
  // §10.4 noindex safeguard. demo/draft/suspended/unknown → fully disallowed.
  const tenant = await getTenantByHost(host);
  if (tenant && tenant.status === "published") {
    return `User-agent: *\nAllow: /\nSitemap: https://${tenant.canonicalHostname}/sitemap.xml\n`;
  }
  return "User-agent: *\nDisallow: /\n";
}
