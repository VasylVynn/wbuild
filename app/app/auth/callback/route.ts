import { NextResponse, type NextRequest } from "next/server";
import { getAuthClient, isAuthConfigured } from "@/lib/supabase/auth";
import { safeNext } from "@/lib/auth/safe-next";

/**
 * Auth landing (public path /auth/callback on the dashboard host). Supabase
 * redirects here with ?code=… after Google OAuth AND after the signup
 * confirmation email (M2 — signUpAction's emailRedirectTo carries the
 * `next=/new?conv=…&resume=1` handoff through this route); the code→session
 * exchange must happen server-side because only route handlers/actions may
 * write the session cookies. PKCE: the verifier cookie was set by
 * signInWithGoogleAction / signUpAction on THIS host, so the exchange only
 * succeeds in the same browser on the same dashboard host — exactly the
 * appOrigin() contract.
 */

export const dynamic = "force-dynamic";

/** Bounce to /login carrying the error kind AND the `next` handoff — losing
 *  `next` here orphans the gate conversation (review must-fix M2/M8). */
function loginBounce(req: NextRequest, error: "auth" | "oauth", next: string): NextResponse {
  const url = new URL("/login", req.url);
  url.searchParams.set("error", error);
  if (next !== "/sites") url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const next = safeNext(req.nextUrl.searchParams.get("next"));

  if (code && isAuthConfigured()) {
    const sb = await getAuthClient();
    const { error } = await sb.auth.exchangeCodeForSession(code);
    // Redirect to the PUBLIC path — middleware maps it into /app on this host.
    if (!error) return NextResponse.redirect(new URL(next, req.url));
    // The exchange failed on a code GoTrue itself accepted: overwhelmingly the
    // confirmation link opened in a browser WITHOUT the PKCE verifier cookie
    // (mobile mail app in-app browser, another device, forwarded link) — this
    // is NOT a Google failure, so the copy must not claim one. Neutral error,
    // handoff preserved.
    return loginBounce(req, "auth", next);
  }

  // No code at all — a genuine provider cancel/misfire (or auth is off).
  return loginBounce(req, "oauth", next);
}
