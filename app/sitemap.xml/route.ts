import { headers } from "next/headers";
import { isPlatformHost, stripPort } from "@/lib/config";
import { getTenantByHost, getPublishedPages } from "@/lib/tenant/data";
import { canonicalUrl, escapeXml } from "@/lib/site/seo";

/**
 * Per-tenant sitemap (§5.2 / §10). Middleware lets /sitemap.xml through
 * untouched, so this handler resolves the tenant from the Host header. It is a
 * tenant-only, published-only artifact: platform hosts and non-published
 * tenants 404 (no sitemap must ever point crawlers at unindexable content).
 */
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const host = stripPort((await headers()).get("host") ?? "");
  if (isPlatformHost(host)) return notFound();

  const tenant = await getTenantByHost(host);
  if (!tenant || tenant.status !== "published") return notFound();

  // All published pages of this tenant; home ("") → bare host URL (§10.1).
  // <lastmod> is omitted — we don't track per-page modification time.
  const pages = await getPublishedPages(host);
  const urls = pages
    .map((p) => `  <url><loc>${escapeXml(canonicalUrl(tenant, p.slug))}</loc></url>`)
    .join("\n");
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

  return new Response(xml, {
    headers: { "content-type": "application/xml; charset=utf-8" },
  });
}

function notFound(): Response {
  return new Response("Not Found", {
    status: 404,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
