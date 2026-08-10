import { NextResponse, type NextRequest } from "next/server";
import { isPlatformHost, isDashboardHost, stripPort } from "@/lib/config";

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
/** The payment provider's `returnUrl` target — before and after the /app
 *  rewrite. The only page in the product a third party POSTs a browser into. */
const PAY_RESULT_PATHS = new Set(["/pay/result", "/app/pay/result"]);

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
    // Dashboard/editor lives on app.<root>, served under the /app namespace.
    if (isDashboardHost(host)) {
      // WayForPay returns the BUYER to `returnUrl` with an HTTP POST — an
      // auto-submitted form from secure.wayforpay.com, not a link. Next reads a
      // POST to a page as a Server Action call and checks the origin against
      // x-forwarded-host; a third party's origin never matches, so it aborts:
      //
      //   `x-forwarded-host` header with value `app.3minsite.com.ua` does not
      //   match `origin` header with value `secure.wayforpay.com` from a
      //   forwarded Server Actions request. Aborting the action.
      //   Invalid Server Actions request. { page: '/app/pay/result' }
      //
      // That is the 500 an owner meets in the seconds after paying — the worst
      // possible moment for one — and why reloading "fixed" it: a reload is a
      // GET. Turn it into one; 303 is the redirect status that CHANGES the
      // method, so Next never classifies the request as an action at all.
      // Deliberately NOT `serverActions.allowedOrigins`: that would let a third
      // party's origin post real actions to us, which is a much larger door
      // than this screen needs. Nothing is lost either — the order reference
      // travels in the query (app/app/pay/actions.ts builds returnUrl that
      // way), and the webhook, never this screen, decides what is paid.
      if (req.method === "POST" && PAY_RESULT_PATHS.has(pathname)) {
        return NextResponse.redirect(req.nextUrl, 303);
      }
      if (pathname === "/app" || pathname.startsWith("/app/")) return NextResponse.next();
      const dest = pathname === "/" ? "/app" : `/app${pathname}`;
      // new URL(pathname, …) drops the query string — carry it over explicitly,
      // exactly as the tenant branch below does. Dashboard screens depend on it
      // (/login?next=, /pay/result?orderReference=).
      const url = new URL(dest, req.url);
      url.search = search;
      return NextResponse.rewrite(url);
    }
    // Root / www: don't expose the /app namespace directly.
    if (pathname === "/app" || pathname.startsWith("/app/")) {
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
