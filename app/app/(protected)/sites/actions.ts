"use server";

import { getServiceClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/tenant/membership";
import { isAuthConfigured, getUser } from "@/lib/supabase/auth";
import { botUsername } from "@/lib/telegram/push";

/**
 * Telegram connect flow (§5.6): ensure a per-tenant one-time token and return
 * the t.me deep link. The webhook binds chat_id when the owner taps Start.
 */
export async function getTelegramConnectLink(
  tenantId: string,
): Promise<{ ok: true; link: string } | { ok: false; error: string }> {
  const gate = await requireMember({ tenantId }); // §3.1 — only owners connect
  if (!gate.ok) return { ok: false, error: gate.error };

  const username = botUsername();
  if (!username) return { ok: false, error: "Telegram-бот ще не налаштований (TELEGRAM_BOT_USERNAME)" };

  const sb = getServiceClient();
  const { data: t } = await sb
    .from("tenants")
    .select("id, telegram_connect_token, telegram_chat_id")
    .eq("id", tenantId)
    .maybeSingle();
  if (!t) return { ok: false, error: "сайт не знайдено" };

  let token = t.telegram_connect_token as string | null;
  if (!token) {
    token = crypto.randomUUID().replace(/-/g, "");
    const { error } = await sb
      .from("tenants")
      .update({ telegram_connect_token: token })
      .eq("id", tenantId);
    if (error) return { ok: false, error: error.message };
  }
  return { ok: true, link: `https://t.me/${username}?start=${token}` };
}

/**
 * Claim anonymously-created sites (§3.1). The browser holds {host, token} pairs
 * from onboarding (localStorage `vitryna_claims`); after the user registers we
 * bind ownership here. A claim succeeds only when the token matches AND the
 * tenant has no members yet — the token is single-use and nulled on success.
 * Every processed host is reported (claimed or rejected) so the client can
 * clear it from localStorage.
 */
export async function claimSitesAction(
  claims: { host: string; token: string }[],
): Promise<{ claimed: string[]; rejected: string[] }> {
  const claimed: string[] = [];
  const rejected: string[] = [];

  // No auth (open dashboard) or not signed in: nothing to bind — drop them all
  // so the client stops retrying.
  if (!isAuthConfigured()) return { claimed, rejected: claims.map((c) => c.host) };
  const user = await getUser();
  if (!user) return { claimed, rejected: claims.map((c) => c.host) };

  const sb = getServiceClient();
  for (const c of claims) {
    const { data: t } = await sb
      .from("tenants")
      .select("id, claim_token")
      .eq("host", c.host)
      .maybeSingle();
    if (!t || !t.claim_token || t.claim_token !== c.token) {
      rejected.push(c.host);
      continue;
    }
    // Only an unowned tenant can be claimed (a valid token stays useless once
    // someone already owns the site).
    const { count } = await sb
      .from("tenant_members")
      .select("tenant_id", { count: "exact", head: true })
      .eq("tenant_id", t.id);
    if ((count ?? 0) > 0) {
      rejected.push(c.host);
      continue;
    }
    const { error } = await sb
      .from("tenant_members")
      .insert({ tenant_id: t.id, user_id: user.id, role: "owner" });
    if (error) {
      rejected.push(c.host);
      continue;
    }
    await sb.from("tenants").update({ claim_token: null }).eq("id", t.id);
    claimed.push(c.host);
  }

  return { claimed, rejected };
}
