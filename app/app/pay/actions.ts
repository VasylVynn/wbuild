"use server";

import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { ROOT_DOMAIN, publicSiteUrl, stripPort } from "@/lib/config";
import { createLogger } from "@/lib/log";
import { trackFunnel } from "@/lib/analytics/funnel";
import { checkRateLimit, ipFromHeaders, rateLimitMessage } from "@/lib/rate-limit";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getUser, isAuthConfigured } from "@/lib/supabase/auth";
import { requireMember } from "@/lib/tenant/membership";
import {
  buildPurchaseFields,
  isPaymentsConfigured,
  priceUah,
  type Checkout,
  type OrderStatus,
} from "@/lib/payments/wayforpay";

/**
 * Checkout creation and result polling for the ₴999 offer (spec 2026-08-05 §2).
 *
 * This file only ever moves an order to `pending`. The transition to `paid`
 * belongs exclusively to the signed WayForPay callback
 * (app/api/payments/wayforpay/route.ts) — nothing a browser can reach may
 * grant paid state.
 */

const log = createLogger("checkout");

const UNAVAILABLE = "Оплата зараз недоступна. Напишіть нам, і ми все владнаємо.";

/** Dashboard origin — WayForPay needs absolute return/service URLs. */
function appOrigin(): string {
  return publicSiteUrl(`app.${stripPort(ROOT_DOMAIN)}`);
}

/**
 * `wfp_<tenant prefix>_<random>`: the tenant prefix makes an order greppable in
 * the WayForPay cabinet, the random tail makes it unguessable — which is what
 * lets getOrderStatusAction skip auth.
 */
function newOrderReference(tenantId: string): string {
  const prefix = tenantId.replace(/-/g, "").slice(0, 8);
  return `wfp_${prefix}_${randomBytes(8).toString("hex")}`;
}

export type CheckoutResult =
  // orderReference is returned alongside the form rather than dug out of
  // checkout.fields: the poller's contract must not depend on WayForPay's
  // field naming.
  | { ok: true; checkout: Checkout; orderReference: string }
  | { ok: false; error: string };

/**
 * Create a pending order and hand back a signed, auto-submittable WayForPay
 * form. Owner-only: an order is bound to a tenant, so anonymous callers and
 * non-members are refused before any DB write.
 */
export async function createCheckoutAction(host: string): Promise<CheckoutResult> {
  const user = await getUser();
  if (!user && isAuthConfigured()) return { ok: false, error: "Потрібен вхід" };

  const gate = await requireMember({ host });
  if (!gate.ok) return { ok: false, error: gate.error };

  const limit = await checkRateLimit("checkout", ipFromHeaders(await headers()));
  if (!limit.ok) return { ok: false, error: rateLimitMessage(limit.retryAfterSec) };

  if (!isPaymentsConfigured() || !isSupabaseConfigured()) {
    log.error("checkout attempted without configuration", {
      host,
      payments: isPaymentsConfigured(),
      supabase: isSupabaseConfigured(),
    });
    return { ok: false, error: UNAVAILABLE };
  }

  const sb = getServiceClient();
  let paidUntil: string | null = null;
  let { data: tenant } = await sb
    .from("tenants")
    .select("id, host, paid_until")
    .eq("host", host)
    .maybeSingle();
  if (tenant) {
    paidUntil = (tenant as { paid_until?: string | null }).paid_until ?? null;
  } else {
    // paid_until may not exist yet (migration 0009 not applied) — that select
    // errors and data is null. Retry without the column so checkout still
    // resolves the tenant; the paywall gate itself stays fail-closed elsewhere.
    const fallback = await sb.from("tenants").select("id, host").eq("host", host).maybeSingle();
    tenant = fallback.data as typeof tenant;
  }
  if (!tenant) return { ok: false, error: "Сайт не знайдено." };

  // A stale tab must not charge twice: an already-paid tenant just publishes.
  if (paidUntil && new Date(paidUntil) > new Date()) {
    return { ok: false, error: "Цей сайт вже оплачено — просто опублікуйте його." };
  }

  const tenantId = tenant.id as string;
  const amount = priceUah();
  const orderReference = newOrderReference(tenantId);

  const { error: insertError } = await sb.from("orders").insert({
    tenant_id: tenantId,
    user_id: user?.id ?? null,
    order_reference: orderReference,
    amount,
    currency: "UAH",
    status: "pending",
  });
  if (insertError) {
    log.error("order insert failed", { host, orderReference, error: insertError.message });
    return { ok: false, error: UNAVAILABLE };
  }

  let checkout: Checkout;
  try {
    const origin = appOrigin();
    checkout = buildPurchaseFields({
      orderReference,
      amount,
      productName: `Сайт + домен на 1 рік — ${host}`,
      returnUrl: `${origin}/pay/result?orderReference=${encodeURIComponent(orderReference)}`,
      serviceUrl: `${origin}/api/payments/wayforpay`,
      clientEmail: user?.email ?? undefined,
    });
  } catch (e) {
    log.error("purchase build failed", { host, orderReference, error: e });
    return { ok: false, error: UNAVAILABLE };
  }

  log.info("checkout created", { host, orderReference, amount });
  await trackFunnel("checkout_created", { tenantId, meta: { orderReference, amount } });

  return { ok: true, checkout, orderReference };
}

export type OrderStatusResult =
  | { ok: true; status: OrderStatus }
  | { ok: false; error: string };

/**
 * Poll target for the result page. No auth by design — the caller is coming
 * back from WayForPay and may have lost the session cookie — which is safe
 * only because the reference is random and the reply carries nothing but the
 * status (no amount, no host, no tenant).
 */
export async function getOrderStatusAction(orderReference: string): Promise<OrderStatusResult> {
  const limit = await checkRateLimit("order_status", ipFromHeaders(await headers()));
  if (!limit.ok) return { ok: false, error: rateLimitMessage(limit.retryAfterSec) };

  const ref = orderReference.trim();
  if (!ref || ref.length > 128) return { ok: false, error: "Замовлення не знайдено." };
  if (!isSupabaseConfigured()) return { ok: false, error: UNAVAILABLE };

  const { data, error } = await getServiceClient()
    .from("orders")
    .select("status")
    .eq("order_reference", ref)
    .maybeSingle();
  if (error) {
    log.warn("order status lookup failed", { orderReference: ref, error: error.message });
    return { ok: false, error: UNAVAILABLE };
  }
  if (!data) return { ok: false, error: "Замовлення не знайдено." };

  return { ok: true, status: data.status as OrderStatus };
}
