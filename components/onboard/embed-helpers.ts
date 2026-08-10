/**
 * Pure helpers for OnboardChat's embedded (landing-hero) mode — W1 of the
 * landing-chat-first plan (§3.1, M3, M6).
 *
 * Client-safe: the only dependency is lib/config, which reads NEXT_PUBLIC_*
 * env inlined at build time.
 */

import { publicSiteUrl, ROOT_DOMAIN } from "@/lib/config";

/**
 * Absolute URL on the DASHBOARD host (`app.<root>`) — the ONE way OnboardChat
 * links cross-host (plan M3). Relative hrefs like `/login`, `/sites` or
 * `/edit/*` break on the marketing root (middleware keeps that host in the
 * marketing namespace → 404), so every cross-host link is built here. On the
 * app host itself the absolute URL is equally correct — one code path, no
 * host conditionals. Already-absolute URLs pass through untouched.
 */
export function appUrl(path = "/"): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${publicSiteUrl(`app.${ROOT_DOMAIN}`)}${path}`;
}

/**
 * sessionStorage key for the M12 same-tab AUTH resume flag. /login writes the
 * conversation id here right before handing the visitor to ANY sign-in route —
 * Google, sign-in, sign-up — and OnboardChat on /new?conv=…&resume=1 consumes
 * it to start generation without a second button press.
 *
 * The discriminator is the TAB, never the auth method. sessionStorage is
 * per-tab AND per-origin, and both /login and /new live on the app host, so
 * the flag exists only for a visitor who is still sitting in the tab where
 * they asked for a site seconds ago. What it excludes is what it always
 * excluded: a confirmation link opened from a mail app, or any later
 * bearer-link visit — a fresh tab carries no flag and must NOT auto-burn
 * generation tokens.
 *
 * The stored string keeps its original name so a session mid-flow across a
 * deploy still resumes.
 */
export const AUTH_RESUME_KEY = "vitryna_oauth_resume";

/**
 * Conversation id carried by a login `next` path (`/new?conv=…`), or null.
 * Pure string parsing — used by /login (set the OAuth flag, default to the
 * signup mode, show the M8 «розмова збережена» line) and kept here next to
 * the other cross-host handoff helpers.
 */
export function convFromNext(next: string | null | undefined): string | null {
  // Path-boundary check: "/new" or "/new?…" only — a bare prefix test would
  // also match unrelated paths like "/newsletter?conv=x" (review must-fix).
  if (!next || !(next === "/new" || next.startsWith("/new?"))) return null;
  const q = next.indexOf("?");
  if (q === -1) return null;
  const conv = new URLSearchParams(next.slice(q + 1)).get("conv");
  return conv && conv.trim() ? conv.trim() : null;
}

export type RestorableConversation = {
  messages: readonly unknown[];
  /** Draft host — present once generation already produced a draft. */
  host?: string;
};

/**
 * Should a stored conversation be restored into the chat on mount? (plan M6)
 *
 * - Any mode: nothing restores without real back-and-forth (>1 message means
 *   the user actually spoke). A PUBLISHED (done) conversation never reaches
 *   this check — the localStorage key is cleared when the phase hits "done".
 * - Embedded (landing hero): only IN-PROGRESS conversations come back. One
 *   that already minted a draft belongs to the app-host preview/publish flow —
 *   restoring it into the hero would invite a second, token-burning
 *   regeneration instead of the existing draft (W2 routes those to preview).
 * - Full mode keeps the W0/V2 behavior unchanged (draft-holding conversations
 *   still restore their chat state).
 */
export function shouldRestoreConversation(
  data: RestorableConversation | null,
  embedded: boolean,
): boolean {
  if (!data || data.messages.length <= 1) return false;
  if (embedded && data.host) return false;
  return true;
}
