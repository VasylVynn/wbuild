"use server";

import { headers } from "next/headers";
import { onboardTurn, type ChatMsg, type OnboardTurnResult } from "@/lib/ai/onboard";
import { publishDraft } from "@/lib/site/publish";
import { checkRateLimit, ipFromHeaders, rateLimitMessage } from "@/lib/rate-limit";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { isAuthConfigured, getUser } from "@/lib/supabase/auth";
import { requireMember } from "@/lib/tenant/membership";
import type { SiteMedia } from "@/lib/media/media";
import type { BusinessFacts } from "@/lib/verticals/schema";
import { runGenerateFlow } from "@/lib/onboard/generate-flow";
import type { GenerateDraftResult } from "@/lib/onboard/generate-flow";
import { trackFunnel } from "@/lib/analytics/funnel";
import { createLogger } from "@/lib/log";

const log = createLogger("onboard-actions");

/**
 * Hard cap on conversation length (messages, both roles). An honest onboarding
 * finishes in ~30 messages; this only stops a script replaying ever-growing
 * histories. Env-tunable like the rest of the limits.
 */
function maxChatMessages(): number {
  const n = Number.parseInt(process.env.RATE_LIMIT_CHAT_MAX_MESSAGES ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : 120;
}

/**
 * Non-stream fallback for the onboarding chat (used when the SSE stream fails,
 * and by /api/dev/onboard). Degraded: single-shot, no scrape/analyze tools — the
 * agentic path is app/api/onboard (SSE). Stateless — the client holds history.
 */
export async function onboardAction(
  history: ChatMsg[],
  facts: Partial<BusinessFacts>,
  verticalId?: string,
  // Client-held flags, echoed back on refusals only (codex review): a
  // rate-limited fallback turn must not wipe ready/confirmed state.
  current?: { ready?: boolean; confirmed?: boolean },
): Promise<OnboardTurnResult> {
  const refuse = (message: string): OnboardTurnResult => ({
    message,
    facts,
    verticalId: verticalId ?? "generic",
    ready: current?.ready ?? false,
    confirmed: current?.confirmed ?? false,
    generate: false,
    quickReplies: [],
    progress: [],
  });

  if (history.length > maxChatMessages()) {
    return refuse(
      "Ця розмова вже дуже довга. Якщо кнопка «Створити сайт» вже зʼявилась — тисніть її, або почніть нову розмову.",
    );
  }

  const limit = await checkRateLimit("chat_turn", ipFromHeaders(await headers()));
  if (!limit.ok) return refuse(rateLimitMessage(limit.retryAfterSec));

  return onboardTurn(history, facts, verticalId);
}

/** Session state for the chat UI's login gate (journal #43). */
export async function sessionStateAction(): Promise<{ authOn: boolean; loggedIn: boolean }> {
  if (!isAuthConfigured()) return { authOn: false, loggedIn: false };
  const user = await getUser();
  return { authOn: true, loggedIn: Boolean(user) };
}

// NOTE: no `export type { GenerateDraftResult }` here — a "use server" module
// registers every export as a server action, and Turbopack leaves a runtime
// reference for the re-export (build-time ReferenceError). The type lives in
// lib/onboard/generate-flow.ts; clients type-import it from there.

/**
 * Non-stream fallback for draft generation (V2, spec §7): the primary
 * transport is POST /api/generate (SSE — stage events, preview at s3), and the
 * whole flow (facts backstop, auth gate, onboard_generate limit, host
 * reuse/mint, pipeline, ownership + conversation re-link, saveDraftHost,
 * funnel) lives in lib/onboard/generate-flow.ts, shared by both. This action
 * stays signature-identical for the client's fallback when the stream fails.
 */
export async function generateDraftAction(
  facts: Partial<BusinessFacts>,
  verticalId?: string,
  media?: SiteMedia,
  conversationId?: string,
): Promise<GenerateDraftResult> {
  return runGenerateFlow({ facts, verticalId, media, conversationId });
}

export type FinalizeResult =
  | { ok: true; url: string }
  | { ok: false; error: string; authRequired?: true };

/** One indexed lookup, best-effort — analytics must never fail a publish. */
async function tenantIdForHost(host: string): Promise<string | undefined> {
  if (!isSupabaseConfigured()) return undefined;
  const { data } = await getServiceClient()
    .from("tenants")
    .select("id")
    .eq("host", host)
    .maybeSingle();
  return (data?.id as string | undefined) ?? undefined;
}

/**
 * Publish-only (invariant 6 — human-only): the owner clicks «Опублікувати» on the
 * draft preview → publish the already-generated draft and return the live URL.
 *
 * Free since 2026-08-06: going live on our subdomain is not sold, so there is no
 * payment hand-off here. The ₴999 gate sits on the custom domain instead
 * (requestDomainAction).
 */
export async function finalizeAction(
  host: string,
  conversationId?: string,
): Promise<FinalizeResult> {
  if (isAuthConfigured()) {
    const user = await getUser();
    if (!user) return { ok: false, error: "Щоб опублікувати, спершу увійдіть.", authRequired: true };
  }
  // Ownership gate — only the draft's owner may publish it.
  const gate = await requireMember({ host });
  if (!gate.ok) return { ok: false, error: gate.error };

  const limit = await checkRateLimit("finalize", ipFromHeaders(await headers()));
  if (!limit.ok) return { ok: false, error: rateLimitMessage(limit.retryAfterSec) };

  // Counted after the gates on purpose: «publish_clicked» should mean an owner
  // who may actually publish, not every bot that can POST the action.
  const tenantId = await tenantIdForHost(host);
  await trackFunnel("publish_clicked", { tenantId, conversationId, meta: { host } });

  try {
    const res = await publishDraft(host);
    if (!res.ok) {
      log.error("publish failed", { host, error: res.error });
      return { ok: false, error: res.error ?? "Не вдалося опублікувати сайт." };
    }

    // Mark the conversation complete (transcript was re-linked at generateDraft).
    if (conversationId && isSupabaseConfigured()) {
      const sb = getServiceClient();
      await sb.from("conversations").update({ is_complete: true }).eq("id", conversationId);
    }

    return { ok: true, url: res.url };
  } catch (e) {
    log.error("publish threw", { host, error: e });
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
