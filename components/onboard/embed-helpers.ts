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
