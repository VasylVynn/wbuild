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
/** The one place the deep link's shape is written. */
function deepLink(username: string, token: string): string {
  return `https://t.me/${username}?start=${token}`;
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

  const existing = t.telegram_connect_token as string | null;
  if (existing) return { ok: true, link: deepLink(username, existing) };

  // MINT UNDER A COMPARE-AND-SWAP. The read above and the write below are two
  // statements, and the token is the tenant's ONLY identity to the bot: the
  // webhook looks a Start up by this exact string and then nulls it (single
  // use, app/api/telegram/webhook/route.ts:40,53). Two callers that both read
  // null used to both mint and both write, and the loser of that write walked
  // away holding a link whose token no longer existed — a button that opens
  // Telegram, says Start, and binds nothing, with no error anywhere to see.
  //
  // Reachable without anyone clicking twice: the publish screen now resolves
  // this link on arrival, React re-invokes effects, and the sites list can be
  // open in another tab. `.is(..., null)` makes the write conditional, so only
  // the first caller writes; everyone else re-reads and returns the token that
  // actually landed.
  const minted = crypto.randomUUID().replace(/-/g, "");
  const { data: won, error } = await sb
    .from("tenants")
    .update({ telegram_connect_token: minted })
    .eq("id", tenantId)
    .is("telegram_connect_token", null)
    .select("telegram_connect_token")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (won?.telegram_connect_token) {
    return { ok: true, link: deepLink(username, won.telegram_connect_token as string) };
  }

  // The CAS matched nothing: another caller minted first (or the owner
  // connected in between and the webhook consumed it). Whatever is on the row
  // now is the only truth — never the string we just made up.
  const { data: after } = await sb
    .from("tenants")
    .select("telegram_connect_token")
    .eq("id", tenantId)
    .maybeSingle();
  const current = (after?.telegram_connect_token as string | null) ?? null;
  if (!current) return { ok: false, error: "не вдалося підготувати посилання, спробуйте ще раз" };
  return { ok: true, link: deepLink(username, current) };
}

