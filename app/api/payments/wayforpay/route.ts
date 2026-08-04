import { NextResponse, type NextRequest } from "next/server";
import { createLogger } from "@/lib/log";
import { trackFunnel } from "@/lib/analytics/funnel";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { sendTelegramMessage } from "@/lib/telegram/push";
import {
  buildServiceResponse,
  mapTransactionStatus,
  parseServicePayload,
  verifyServiceSignature,
  type ServicePayload,
} from "@/lib/payments/wayforpay";

/**
 * WayForPay `serviceUrl` callback — THE source of truth for paid state
 * (spec 2026-08-05 §2). Docs: https://wiki.wayforpay.com/en/view/852102
 *
 * Rules this handler exists to enforce:
 *  - fail-closed: no valid HMAC → no state change, ever;
 *  - idempotent: WayForPay retries until acknowledged, so the pending→paid
 *    transition is a conditional UPDATE, not a read-then-write;
 *  - always answer with the signed {orderReference, status:"accept", time,
 *    signature} body — "accept" acknowledges the NOTIFICATION, not the payment,
 *    and withholding it only buys an infinite retry loop;
 *  - never throw: a stack trace here becomes an HTML 500 that WayForPay cannot
 *    parse, and the order silently never settles.
 */

export const runtime = "nodejs"; // node:crypto for HMAC
export const dynamic = "force-dynamic";

const log = createLogger("wayforpay");

/**
 * A year of service, per the offer («сайт + домен на 1 рік»). A renewal paid
 * BEFORE expiry extends from the current paid_until, not from today — early
 * renewal must not burn the unused remainder.
 */
function oneYearFrom(current: string | null | undefined): string {
  const now = new Date();
  const base =
    current && new Date(current) > now ? new Date(current) : now;
  base.setUTCFullYear(base.getUTCFullYear() + 1);
  return base.toISOString();
}

function ack(orderReference: string) {
  return NextResponse.json(buildServiceResponse(orderReference));
}

export async function POST(req: NextRequest) {
  const raw = await req.text().catch(() => "");
  const payload = parseServicePayload(raw);

  if (!payload) {
    // Unparseable: we don't even know which order to acknowledge. Structured
    // 400 so this shows up as an error, never an HTML page.
    log.warn("callback body could not be parsed", { bytes: raw.length });
    return NextResponse.json({ error: "bad payload" }, { status: 400 });
  }

  const orderReference = payload.orderReference;

  if (!verifyServiceSignature(payload)) {
    log.warn("callback signature rejected — order untouched", {
      orderReference,
      transactionStatus: payload.transactionStatus,
    });
    return ack(orderReference);
  }

  if (!isSupabaseConfigured()) {
    // A config outage must not swallow a real payment: withholding the ack
    // makes WayForPay keep retrying until the deploy is fixed.
    log.error("verified callback NOT acknowledged: supabase not configured", {
      orderReference,
    });
    return NextResponse.json({ error: "storage unavailable" }, { status: 503 });
  }

  try {
    await applyCallback(payload);
  } catch (e) {
    // Acknowledged anyway would lose the event, so let WayForPay retry: a 500
    // here is a real outage, not bad input.
    log.error("callback processing threw", { orderReference, error: e });
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }

  return ack(orderReference);
}

async function applyCallback(payload: ServicePayload): Promise<void> {
  const sb = getServiceClient();
  const orderReference = payload.orderReference;
  const target = mapTransactionStatus(payload.transactionStatus);

  // Supabase clients report failures via `error`, they don't throw. Before the
  // paid-latch, ANY database error must throw → 500 → WayForPay retries.
  // Treating a transient read failure as "row absent" would acknowledge the
  // callback and permanently lose a paid entitlement.
  const { data: order, error: lookupError } = await sb
    .from("orders")
    .select("id, tenant_id, amount, currency, status")
    .eq("order_reference", orderReference)
    .maybeSingle();
  if (lookupError) throw new Error(`order lookup failed: ${lookupError.message}`);

  if (!order) {
    // Signature was valid, so this really is WayForPay — an order we never
    // wrote means the checkout insert failed or the DB was restored. Loud, but
    // still acknowledged: retrying will not make the row appear.
    log.error("verified callback for unknown order", {
      orderReference,
      transactionStatus: payload.transactionStatus,
    });
    return;
  }

  // Nullable since migration 0009 keeps orders when a tenant is deleted
  // (financial records outlive test-site cleanup).
  const tenantId = order.tenant_id as string | null;

  if (order.status === "paid" && target === "paid") {
    log.info("callback replay ignored (already paid)", { orderReference });
    return;
  }

  if (target === null) {
    log.info("callback in flight, order unchanged", {
      orderReference,
      transactionStatus: payload.transactionStatus,
    });
    const { error: inflightError } = await sb
      .from("orders")
      .update({ wfp_payload: payload, updated_at: new Date().toISOString() })
      .eq("id", order.id);
    if (inflightError) throw new Error(`in-flight update failed: ${inflightError.message}`);
    return;
  }

  if (target !== "paid") {
    // declined/expired only ever close a PENDING order. A refund is different:
    // it legitimately arrives for a PAID order (chargeback, manual refund in
    // the WayForPay cabinet) and must both be recorded and revoke the year —
    // otherwise a charged-back site keeps serving and the funnel keeps
    // counting its ₴999 as revenue.
    const allowedFrom = target === "refunded" ? ["pending", "paid"] : ["pending"];
    const { data: transitioned, error: transitionError } = await sb
      .from("orders")
      .update({ status: target, wfp_payload: payload, updated_at: new Date().toISOString() })
      .eq("id", order.id)
      .in("status", allowedFrom)
      .select("id");
    if (transitionError)
      throw new Error(`status transition failed: ${transitionError.message}`);

    if (
      target === "refunded" &&
      order.status === "paid" &&
      transitioned &&
      transitioned.length > 0
    ) {
      if (tenantId) {
        const { error: revokeError } = await sb
          .from("tenants")
          .update({ paid_until: null })
          .eq("id", tenantId);
        if (revokeError) {
          log.error("REFUND RECORDED BUT paid_until NOT REVOKED — fix manually", {
            orderReference,
            tenantId,
            error: revokeError.message,
          });
        }
      }
      log.error("paid order refunded — access revoked", { orderReference, tenantId });
      await notifyAdmin(orderReference, tenantId, payload, "refund");
      return;
    }

    log.info("order closed unpaid", {
      orderReference,
      status: target,
      reason: payload.reason ?? null,
    });
    return;
  }

  // ── Approved ───────────────────────────────────────────────────────────────
  // The HMAC proves the message is WayForPay's; it does not prove they charged
  // what we asked for. Underpayment must not buy a year of service.
  const paidAmount = Number(payload.amount);
  const expected = Number(order.amount);
  if (!Number.isFinite(paidAmount) || paidAmount + 0.01 < expected) {
    log.error("approved callback underpays the order — not granting access", {
      orderReference,
      paid: payload.amount,
      expected: order.amount,
    });
    return;
  }
  if (payload.currency !== order.currency) {
    log.error("approved callback currency mismatch — not granting access", {
      orderReference,
      got: payload.currency,
      expected: order.currency,
    });
    return;
  }

  const now = new Date().toISOString();
  // Conditional update = the idempotency latch. Concurrent retries re-read the
  // row under lock, so exactly one of them sees an eligible status and gets
  // the side effects below. Only pending (normal flow) and declined (the same
  // reference retried with a working card) may become paid — a REFUNDED order
  // replayed with an old valid Approved callback must NOT re-grant the year.
  const { data: claimed, error: claimError } = await sb
    .from("orders")
    .update({ status: "paid", paid_at: now, wfp_payload: payload, updated_at: now })
    .eq("id", order.id)
    .in("status", ["pending", "declined"])
    .select("id");
  // Pre-latch failure: nothing was claimed, so throwing is safe — the retry
  // starts over. (Errors AFTER the latch must not throw: the retry would be
  // ignored as a replay, so they log loudly and get fixed by hand instead.)
  if (claimError) throw new Error(`paid latch failed: ${claimError.message}`);

  if (!claimed || claimed.length === 0) {
    log.info("callback replay ignored (claimed by a concurrent retry)", { orderReference });
    return;
  }

  if (!tenantId) {
    log.error("PAID ORDER WITHOUT TENANT — refund manually", { orderReference });
  } else {
    const { data: tenantRow, error: tenantReadError } = await sb
      .from("tenants")
      .select("paid_until")
      .eq("id", tenantId)
      .maybeSingle();
    if (tenantReadError) {
      // Post-latch, so no throw: fall back to extending from now — worst case
      // an early renewal loses its unused remainder, which the log records.
      log.warn("paid_until read failed — extending from now", {
        orderReference,
        tenantId,
        error: tenantReadError.message,
      });
    }
    const { error: tenantError } = await sb
      .from("tenants")
      .update({ paid_until: oneYearFrom(tenantRow?.paid_until as string | null) })
      .eq("id", tenantId);
    if (tenantError) {
      // The order is paid and the money is real — surface loudly so it can be
      // fixed by hand rather than rolled back.
      log.error("PAID ORDER BUT paid_until NOT SET — fix manually", {
        orderReference,
        tenantId,
        error: tenantError.message,
      });
    }
  }

  log.info("payment approved", { orderReference, tenantId, amount: payload.amount });
  await trackFunnel("payment_success", {
    tenantId: tenantId ?? undefined,
    meta: { orderReference, amount: payload.amount },
  });

  await notifyAdmin(orderReference, tenantId, payload);
}

/** Best-effort admin ping — a failed push must never affect the order. */
async function notifyAdmin(
  orderReference: string,
  tenantId: string | null,
  payload: ServicePayload,
  kind: "paid" | "refund" = "paid",
): Promise<void> {
  const adminChat = process.env.ADMIN_TELEGRAM_CHAT_ID;
  if (!adminChat) return;
  try {
    let host = tenantId ?? "невідомий тенант";
    let businessName = host;
    if (tenantId) {
      const { data: tenant } = await getServiceClient()
        .from("tenants")
        .select("host, brand")
        .eq("id", tenantId)
        .maybeSingle();
      host = (tenant?.host as string | undefined) ?? tenantId;
      businessName =
        (tenant?.brand as { businessName?: string } | null)?.businessName ?? host;
    }
    const title =
      kind === "refund"
        ? `↩️ <b>Повернення ${payload.amount} ${payload.currency} — доступ знято</b>`
        : `💸 <b>Нова оплата ${payload.amount} ${payload.currency}</b>`;
    await sendTelegramMessage(
      adminChat,
      `${title}\n\n🏪 ${businessName}\n🌐 ${host}\n🧾 ${orderReference}`,
    );
  } catch (e) {
    log.warn("admin telegram push failed", { orderReference, error: e });
  }
}
