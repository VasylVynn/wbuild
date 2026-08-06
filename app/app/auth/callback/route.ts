import { NextResponse, type NextRequest } from "next/server";
import { getAuthClient, isAuthConfigured } from "@/lib/supabase/auth";

/**
 * OAuth landing (public path /auth/callback on the dashboard host). Supabase
 * redirects here with ?code=… after Google; the code→session exchange must
 * happen server-side because only route handlers/actions may write the
 * session cookies. PKCE: the verifier cookie was set by
 * signInWithGoogleAction on THIS host, so the exchange only succeeds in the
 * same browser on the same dashboard host — exactly the appOrigin() contract.
 */

export const dynamic = "force-dynamic";

/** Same-origin paths only — mirrors safeNext in login/actions.ts (a "use server" file cannot export helpers). */
function safeNext(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/sites";
  return next;
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const next = safeNext(req.nextUrl.searchParams.get("next"));

  if (code && isAuthConfigured()) {
    const sb = await getAuthClient();
    const { error } = await sb.auth.exchangeCodeForSession(code);
    // Redirect to the PUBLIC path — middleware maps it into /app on this host.
    if (!error) return NextResponse.redirect(new URL(next, req.url));
  }

  return NextResponse.redirect(new URL("/login?error=oauth", req.url));
}
