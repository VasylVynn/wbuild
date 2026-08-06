import "server-only";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { createLogger } from "@/lib/log";
import { phServerCapture } from "@/lib/analytics/posthog-server";

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

export type FunnelIds = {
  tenantId?: string;
  conversationId?: string;
  meta?: Record<string, unknown>;
};

/**
 * The ONE chokepoint for funnel analytics: writes our own funnel_events row AND
 * mirrors the step to PostHog. Both sinks are best-effort and neither can throw,
 * so the two run concurrently — a funnel step must not pay for two sequential
 * round-trips. Keeping the mirror here (rather than at each call site) is why
 * every step is guaranteed to reach both.
 */
export async function trackFunnel(kind: FunnelKind, ids: FunnelIds = {}): Promise<void> {
  await Promise.all([insertFunnelEvent(kind, ids), mirrorToPostHog(kind, ids)]);
}

async function insertFunnelEvent(kind: FunnelKind, ids: FunnelIds): Promise<void> {
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

/**
 * A tenant exists only after onboarding, so early steps can identify by
 * conversation alone — the same id the browser SDK uses before signup, which is
 * what lets a pre-signup chat and a post-payment tenant stitch into one funnel.
 */
async function mirrorToPostHog(kind: FunnelKind, ids: FunnelIds): Promise<void> {
  await phServerCapture(kind, ids.tenantId ?? ids.conversationId ?? "anonymous", {
    ...(ids.tenantId ? { tenantId: ids.tenantId } : {}),
    ...(ids.conversationId ? { conversationId: ids.conversationId } : {}),
    ...(ids.meta ?? {}),
  });
}
