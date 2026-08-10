"use server";

import { getServiceClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/tenant/membership";
import { botUsername } from "@/lib/telegram/push";

/**
 * Telegram connect flow (§5.6): ensure a per-tenant one-time token and return
 * the t.me deep link. The webhook binds chat_id when the owner taps Start.
 */

/**
 * The same link, addressed the way the rest of the product addresses a site:
 * by HOST. The publish moment knows the host it just made live and nothing
 * else, and it used to "connect Telegram" by sending the owner to the sites
 * LIST to find their own card and press a differently-named button there —
 * three presses and a host hop for the one step that makes the product pay.
 *
 * Ownership is gated twice on purpose: once here, because a host is a public
 * string anyone could post, and once inside by tenant id. The cost is one
 * extra membership read on a screen reached once per site.
 */
export async function getTelegramConnectLinkForHost(
  host: string,
): Promise<{ ok: true; link: string } | { ok: false; error: string }> {
  const gate = await requireMember({ host });
  if (!gate.ok) return { ok: false, error: gate.error };

  const sb = getServiceClient();
  const { data: t } = await sb.from("tenants").select("id").eq("host", host).maybeSingle();
  if (!t) return { ok: false, error: "сайт не знайдено" };
  return getTelegramConnectLink(t.id as string);
}
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

