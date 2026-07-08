"use server";

import { headers } from "next/headers";
import { onboardTurn, type ChatMsg, type OnboardTurnResult } from "@/lib/ai/onboard";
import { uniqueSubdomain } from "@/lib/tenant/subdomain";
import { generateAndPublish } from "@/lib/site/publish";
import { classifyVertical } from "@/lib/verticals/registry";
import { ROOT_DOMAIN } from "@/lib/config";
import { checkRateLimit, ipFromHeaders, rateLimitMessage } from "@/lib/rate-limit";
import { getServiceClient } from "@/lib/supabase/server";
import { isAuthConfigured, getUser } from "@/lib/supabase/auth";
import type { BusinessFacts } from "@/lib/verticals/schema";

/**
 * Hard cap on conversation length (messages, both roles). An honest onboarding
 * finishes in ~30 messages; this only stops a script replaying ever-growing
 * histories. Env-tunable like the rest of the limits.
 */
function maxChatMessages(): number {
  const n = Number.parseInt(process.env.RATE_LIMIT_CHAT_MAX_MESSAGES ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : 120;
}

/** One onboarding chat turn (stateless — the client holds history + facts). */
export async function onboardAction(
  history: ChatMsg[],
  facts: Partial<BusinessFacts>,
  verticalId?: string,
): Promise<OnboardTurnResult> {
  // Both checks run BEFORE the Anthropic call — a limited turn costs no tokens.
  // Limited turns come back as a normal assistant message, so the chat UI
  // degrades gracefully instead of crashing.
  const refuse = (message: string): OnboardTurnResult => ({
    message,
    facts,
    verticalId: verticalId ?? "generic",
    ready: false,
  });

  if (history.length > maxChatMessages()) {
    return refuse(
      "Ця розмова вже дуже довга. Натисніть «Все вірно, генеруємо» — або почніть нову розмову.",
    );
  }

  const limit = await checkRateLimit("chat_turn", ipFromHeaders(await headers()));
  if (!limit.ok) return refuse(rateLimitMessage(limit.retryAfterSec));

  return onboardTurn(history, facts, verticalId);
}

export type FinalizeResult =
  | { ok: true; host: string; url: string; claimToken?: string }
  | { ok: false; error: string };

/** Confirmed facts → generate + publish the site → return its live URL. */
export async function finalizeAction(
  facts: BusinessFacts,
  verticalId?: string,
): Promise<FinalizeResult> {
  // Generation is the most expensive AI call — gate it before any work starts.
  const limit = await checkRateLimit("finalize", ipFromHeaders(await headers()));
  if (!limit.ok) return { ok: false, error: rateLimitMessage(limit.retryAfterSec) };

  try {
    const vId =
      verticalId ??
      classifyVertical(
        [facts.businessName, facts.about, ...(facts.services?.map((s) => s.name) ?? [])]
          .filter(Boolean)
          .join(" "),
      );
    const host = await uniqueSubdomain(facts.businessName);
    await generateAndPublish(facts, host, vId, true);
    const isProd = process.env.NODE_ENV === "production";
    const port = ROOT_DOMAIN.includes(":") ? `:${ROOT_DOMAIN.split(":")[1]}` : "";
    const url = `${isProd ? "https" : "http"}://${host}${isProd ? "" : port}`;

    // Ownership (§3.1). Onboarding is anonymous, so tie the new site to whoever
    // created it: a logged-in creator becomes owner immediately; an anonymous
    // one gets a one-time claim_token to bind the site after they register.
    // Skipped entirely when auth is off (open dashboard — degradation).
    let claimToken: string | undefined;
    if (isAuthConfigured()) {
      const sb = getServiceClient();
      const { data: t } = await sb.from("tenants").select("id").eq("host", host).maybeSingle();
      if (t) {
        const user = await getUser();
        if (user) {
          await sb
            .from("tenant_members")
            .insert({ tenant_id: t.id, user_id: user.id, role: "owner" });
        } else {
          claimToken = crypto.randomUUID().replace(/-/g, "");
          await sb.from("tenants").update({ claim_token: claimToken }).eq("id", t.id);
        }
      }
    }

    return { ok: true, host, url, ...(claimToken && { claimToken }) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
