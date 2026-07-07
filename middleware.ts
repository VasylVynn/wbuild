import { NextResponse, type NextRequest } from "next/server";
import { isPlatformHost, stripPort } from "@/lib/config";

/**
 * First step of every request: split platform from tenant (brief §2.5).
 *
 *  1) Platform host (marketing root, app dashboard) → no tenant rewrite.
 *  2) Anything else = a tenant → rewrite to the internal path
 *     /s/{host}/{path}. For MVP (subdomains only) request host == canonical
 *     host, so we rewrite on the request host. Custom-domain 301→canonical
 *     (§10.2) is deferred together with the domains feature.
 *
 * Middleware must NOT hit Postgres per request (§2.5); it only inspects Host.
 */
export function middleware(req: NextRequest): NextResponse {
  const host = stripPort(req.headers.get("host") ?? "");
  const { pathname, search } = req.nextUrl;

  // sitemap.xml / robots.txt must reach their app routes (served via headers()),
  // never be tenant-rewritten (§5.2). They pass through untouched.
  if (pathname === "/sitemap.xml" || pathname === "/robots.txt") {
    return NextResponse.next();
  }

  if (isPlatformHost(host)) {
    // The internal tenant namespace must not be reachable on platform hosts.
    if (pathname === "/s" || pathname.startsWith("/s/")) {
      return NextResponse.rewrite(new URL("/_platform-404", req.url));
    }
    return NextResponse.next();
  }

  // Tenant → internal namespace `app/s/[host]/[[...slug]]`. NOTE: an
  // underscore-prefixed folder (`_sites`) is a Next PRIVATE folder and is
  // excluded from routing — hence `s`. Avoid a trailing slash on the root.
  const dest = pathname === "/" ? `/s/${host}` : `/s/${host}${pathname}`;
  const url = new URL(dest, req.url);
  url.search = search;
  return NextResponse.rewrite(url);
}

export const config = {
  // Run on everything EXCEPT Next internals, API routes and static assets.
  // Note: .xml/.txt are intentionally NOT excluded so sitemap/robots reach
  // middleware for the future host 301 check (§5.2); they're short-circuited
  // above rather than rewritten.
  matcher: [
    "/((?!_next/|api/|.*\\.(?:ico|png|jpg|jpeg|gif|svg|webp|avif|css|js|map|woff|woff2|ttf|otf)$).*)",
  ],
};
