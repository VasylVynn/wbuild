import "server-only";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { createLogger } from "@/lib/log";

/**
 * Internal funnel analytics for the paid offer test (spec 2026-08-05 §5):
 * one row per funnel step in funnel_events (migration 0009). Best-effort —
 * a broken analytics insert must never break the funnel itself.
 *
 * Distinct from site_events: that table counts VISITOR events on tenant sites
 * (resolved from Host, CHECK-constrained kinds); this one counts OUR platform
 * funnel steps, written server-side from actions/routes.
 */

const log = createLogger("funnel");

export type FunnelKind =
  | "chat_start"
  | "draft_generated"
  | "publish_clicked"
  | "checkout_created"
  | "payment_success"
  | "domain_requested";

export async function trackFunnel(
  kind: FunnelKind,
  ids: { tenantId?: string; conversationId?: string; meta?: Record<string, unknown> } = {},
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    const { error } = await getServiceClient().from("funnel_events").insert({
      kind,
      tenant_id: ids.tenantId ?? null,
      conversation_id: ids.conversationId ?? null,
      meta: ids.meta ?? null,
    });
    if (error) log.warn("funnel insert failed", { kind, error: error.message });
  } catch (e) {
    log.warn("funnel insert threw", { kind, error: e });
  }
}
