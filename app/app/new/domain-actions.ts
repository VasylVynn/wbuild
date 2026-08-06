"use server";

import { headers } from "next/headers";
import { checkRateLimit, ipFromHeaders, rateLimitMessage } from "@/lib/rate-limit";
import { normalizeDomain, checkAvailability, type DomainAvailability } from "@/lib/domains/rdap";
import { isAuthConfigured, getUser } from "@/lib/supabase/auth";
import { requireMember } from "@/lib/tenant/membership";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { trackFunnel } from "@/lib/analytics/funnel";
import { sendTelegramMessage } from "@/lib/telegram/push";
import { priceUah } from "@/lib/payments/wayforpay";
import { createLogger } from "@/lib/log";

/**
 * Domain step — THE paid step (owner decision 2026-08-06, superseding spec
 * 2026-08-05 §3/§4). Building and publishing on our subdomain are free; the
 * ₴999 buys the custom domain plus a year of running it. So this file, not
 * publishDraft, is where the money gate lives.
 *
 * Registration itself is MANUAL ops — requestDomainAction writes
 * `requested_domain` and pings the admin; a human buys the name and later runs
 * adminActivateDomainAction. Nothing here ever puts a site on a domain by itself.
 */

const log = createLogger("domains");

const INVALID = "Некоректне доменне ім'я";
/** Shown above the payment panel, so it reads as an offer and not a failure. */
const PAYMENT_NEEDED = "Власний домен — платна послуга.";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export type CheckDomainResult =
  | { ok: true; domain: string; available: DomainAvailability }
  | { ok: false; error: string };

/**
 * Availability lookup for the domain input. Rate-limited before the outbound
 * RDAP call so a script can't turn our funnel into a bulk WHOIS proxy.
 */
export async function checkDomainAction(domain: string): Promise<CheckDomainResult> {
  const limit = await checkRateLimit("domain_check", ipFromHeaders(await headers()));
  if (!limit.ok) return { ok: false, error: rateLimitMessage(limit.retryAfterSec) };

  const normalized = normalizeDomain(domain);
  if (!normalized) return { ok: false, error: INVALID };

  const available = await checkAvailability(normalized);
  return { ok: true, domain: normalized, available };
}

export type RequestDomainResult =
  | { ok: true }
  // `price` rides the paywall refusal so the payment panel quotes the amount the
  // server will actually charge (PRICE_UAH env), never a number hardcoded in the UI.
  | { ok: false; error: string; authRequired?: true; paymentRequired?: true; price?: number };

/**
 * «Замовити домен» — the ₴999 choke point: an unpaid tenant gets
 * `paymentRequired` instead of a saved request, and the UI swaps in the payment
 * panel. Once paid, records the choice against the tenant and notifies the admin.
 * Deliberately allows a "taken"/"unknown" name through: the operator checks again
 * at the registrar and calls the owner back if it's gone.
 */
export async function requestDomainAction(
  host: string,
  domain: string,
): Promise<RequestDomainResult> {
  // Shares the lookup bucket: every call pushes a Telegram message to the
  // platform admin, so an unlimited action is a free way to flood that chat.
  const limit = await checkRateLimit("domain_check", ipFromHeaders(await headers()));
  if (!limit.ok) return { ok: false, error: rateLimitMessage(limit.retryAfterSec) };

  if (isAuthConfigured()) {
    const user = await getUser();
    if (!user) return { ok: false, error: "Щоб замовити домен, спершу увійдіть.", authRequired: true };
  }
  const gate = await requireMember({ host });
  if (!gate.ok) return { ok: false, error: gate.error };

  const normalized = normalizeDomain(domain);
  if (!normalized) return { ok: false, error: INVALID };

  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Сервіс тимчасово недоступний. Спробуйте пізніше." };
  }

  const sb = getServiceClient();

  // The paywall (owner decision 2026-08-06). Unlike the rate limits, this fails
  // CLOSED: an unreadable `paid_until` — migration 0009 not applied — must read
  // as «unpaid» and offer the payment panel, never as a free domain. Publishing
  // is unaffected either way; only this step is sold.
  const { data: paidRow, error: paidErr } = await sb
    .from("tenants")
    .select("id, paid_until")
    .eq("host", host)
    .maybeSingle();
  if (paidErr || !paidRow) {
    // Distinguish «column missing» from «no such tenant»: the first is our
    // misconfiguration and the owner can still pay their way through it, the
    // second is a dead end that must say so.
    const { data: probe } = await sb.from("tenants").select("id").eq("host", host).maybeSingle();
    if (!probe) {
      log.error("domain request — tenant not found", { host, error: paidErr?.message });
      return { ok: false, error: "Сайт не знайдено." };
    }
    log.error("paywall column unreadable — treating tenant as unpaid", {
      host,
      error: paidErr?.message,
      hint: "apply supabase/migrations/0009_payments.sql",
    });
    return { ok: false, error: PAYMENT_NEEDED, paymentRequired: true, price: priceUah() };
  }

  const paidUntilRaw = (paidRow as { paid_until?: string | null }).paid_until ?? null;
  const paidUntil = paidUntilRaw ? Date.parse(paidUntilRaw) : NaN;
  if (!Number.isFinite(paidUntil) || paidUntil <= Date.now()) {
    log.info("domain request blocked — not paid", { host, paidUntil: paidUntilRaw });
    return { ok: false, error: PAYMENT_NEEDED, paymentRequired: true, price: priceUah() };
  }

  const { data: tenant, error } = await sb
    .from("tenants")
    .update({ requested_domain: normalized, domain_status: "requested" })
    .eq("host", host)
    .select("id, brand")
    .maybeSingle();

  if (error || !tenant) {
    log.error("domain request not saved", { host, domain: normalized, error: error?.message });
    return { ok: false, error: "Не вдалося зберегти домен. Спробуйте ще раз." };
  }

  const tenantId = tenant.id as string;
  await trackFunnel("domain_requested", { tenantId, meta: { domain: normalized } });
  log.info("domain requested", { host, domain: normalized, tenantId });

  // Best-effort push to the platform admin — the ops clock («протягом ~4 годин»)
  // starts here, but a dead Telegram must not fail the owner's request.
  const adminChat = process.env.ADMIN_TELEGRAM_CHAT_ID;
  if (adminChat) {
    const businessName = (tenant.brand as { businessName?: string } | null)?.businessName ?? host;
    await sendTelegramMessage(
      adminChat,
      `🌐 <b>Замовлено домен ${esc(normalized)}</b> для ${esc(host)}\n\n🏪 ${esc(businessName)}`,
    );
  }

  return { ok: true };
}
