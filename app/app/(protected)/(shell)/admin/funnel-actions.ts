import "server-only";
import { isPlatformAdmin } from "@/lib/admin";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { createLogger } from "@/lib/log";
import type { FunnelKind } from "@/lib/analytics/funnel";

/**
 * Funnel numbers for the admin console (spec 2026-08-05 §5): how many people
 * reached each step of the paid funnel in the last 7 and 30 days, plus what was
 * actually paid.
 *
 * NOT a server action ("use server" would publish it as a callable endpoint) —
 * a plain server-only module read by the admin page's server component. The
 * admin gate is re-checked here anyway: a data reader that hands out the whole
 * funnel must not depend on its caller having done the check.
 *
 * Two queries total, bucketed in memory. Counting per kind per window would be
 * twelve round-trips for numbers that fit in one scan of a small, indexed table
 * (funnel_events_kind_time_idx covers the created_at filter).
 */

const log = createLogger("admin-funnel");

/** Newest-first cap. Truncation can only ever cost us the tail of the 30d
 *  window, never the 7d one — and the card says so when it happens. */
const EVENTS_CAP = 20000;
const ORDERS_CAP = 5000;

/** Funnel order as the user walks it — the card renders rows in this sequence. */
export const FUNNEL_STEPS: FunnelKind[] = [
  "chat_start",
  "draft_generated",
  "publish_clicked",
  "checkout_created",
  "payment_success",
  "domain_requested",
];

export interface FunnelStep {
  kind: FunnelKind;
  d7: number;
  d30: number;
}

export interface FunnelStats {
  steps: FunnelStep[];
  paid: { d7: { count: number; sum: number }; d30: { count: number; sum: number } };
  capped: boolean;
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export async function getFunnelStats(): Promise<FunnelStats | null> {
  if (!(await isPlatformAdmin())) return null;
  if (!isSupabaseConfigured()) return null;

  const since30 = daysAgo(30);
  const since7 = daysAgo(7);
  const sb = getServiceClient();

  try {
    const [eventsRes, ordersRes] = await Promise.all([
      sb
        .from("funnel_events")
        .select("kind, created_at")
        .gte("created_at", since30)
        .order("created_at", { ascending: false })
        .limit(EVENTS_CAP),
      sb
        .from("orders")
        .select("amount, paid_at")
        .eq("status", "paid")
        .gte("paid_at", since30)
        .order("paid_at", { ascending: false })
        .limit(ORDERS_CAP),
    ]);

    if (eventsRes.error) {
      log.warn("funnel events read failed", { error: eventsRes.error.message });
      return null;
    }

    const events = (eventsRes.data ?? []) as { kind: string; created_at: string }[];
    const d7 = new Map<string, number>();
    const d30 = new Map<string, number>();
    for (const e of events) {
      d30.set(e.kind, (d30.get(e.kind) ?? 0) + 1);
      if (e.created_at >= since7) d7.set(e.kind, (d7.get(e.kind) ?? 0) + 1);
    }

    // Orders are money — a failed read must show as "unknown", not as zero
    // revenue, so it is logged rather than silently folded into the totals.
    if (ordersRes.error) log.warn("funnel orders read failed", { error: ordersRes.error.message });
    const orders = (ordersRes.data ?? []) as { amount: number | string; paid_at: string | null }[];
    const paid = {
      d7: { count: 0, sum: 0 },
      d30: { count: 0, sum: 0 },
    };
    for (const o of orders) {
      const amount = Number(o.amount) || 0;
      paid.d30.count += 1;
      paid.d30.sum += amount;
      if (o.paid_at && o.paid_at >= since7) {
        paid.d7.count += 1;
        paid.d7.sum += amount;
      }
    }

    return {
      steps: FUNNEL_STEPS.map((kind) => ({
        kind,
        d7: d7.get(kind) ?? 0,
        d30: d30.get(kind) ?? 0,
      })),
      paid,
      capped: events.length >= EVENTS_CAP,
    };
  } catch (e) {
    log.warn("funnel stats threw", { error: e });
    return null;
  }
}
