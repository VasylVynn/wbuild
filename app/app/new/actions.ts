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
import { sanitizeMedia, type SiteMedia } from "@/lib/media/media";
import { businessFactsSchema, type BusinessFacts } from "@/lib/verticals/schema";

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
  templateId?: string,
): Promise<OnboardTurnResult> {
  // Both checks run BEFORE the Anthropic call — a limited turn costs no tokens.
  // Limited turns come back as a normal assistant message, so the chat UI
  // degrades gracefully instead of crashing.
  const refuse = (message: string): OnboardTurnResult => ({
    message,
    facts,
    verticalId: verticalId ?? "generic",
    ready: false,
    confirmed: false,
    quickReplies: [],
    progress: [],
  });

  if (history.length > maxChatMessages()) {
    return refuse(
      "Ця розмова вже дуже довга. Натисніть «Все вірно, генеруємо» — або почніть нову розмову.",
    );
  }

  const limit = await checkRateLimit("chat_turn", ipFromHeaders(await headers()));
  if (!limit.ok) return refuse(rateLimitMessage(limit.retryAfterSec));

  return onboardTurn(history, facts, verticalId, templateId);
}

export type FinalizeResult =
  | { ok: true; host: string; url: string }
  | { ok: false; error: string; authRequired?: true };

/** Session state for the chat UI's login gate (journal #43). */
export async function sessionStateAction(): Promise<{ authOn: boolean; loggedIn: boolean }> {
  if (!isAuthConfigured()) return { authOn: false, loggedIn: false };
  const user = await getUser();
  return { authOn: true, loggedIn: Boolean(user) };
}

/** Confirmed facts → generate + publish the site → return its live URL. */
export async function finalizeAction(
  facts: BusinessFacts,
  verticalId?: string,
  media?: SiteMedia,
  conversationId?: string,
): Promise<FinalizeResult> {
  // Re-validate media server-side (client input is untrusted): bad/foreign URLs
  // or an over-long list collapse to no media rather than reaching the site.
  const cleanMedia = sanitizeMedia(media);
  // Server-side backstop (adversarial review): the chat ready-gate normally
  // guarantees the required trio, but this is a public server action — a
  // bypassed client must not reach generation with a hollow facts object.
  const parsedFacts = businessFactsSchema.safeParse(facts);
  if (
    !parsedFacts.success ||
    !parsedFacts.data.businessName.trim() ||
    !parsedFacts.data.city.trim() ||
    !parsedFacts.data.phone.trim()
  ) {
    return {
      ok: false,
      error: "Бракує обовʼязкових даних — назви, міста або телефону. Поверніться до розмови й додайте їх.",
    };
  }
  // Generation requires a signed-in user (§3.1 invariant, journal #43): the
  // tenant gets its owner at creation; no anonymous generation, no claim flow.
  let ownerId: string | null = null;
  if (isAuthConfigured()) {
    const user = await getUser();
    if (!user) {
      return { ok: false, error: "Щоб створити сайт, спершу увійдіть.", authRequired: true };
    }
    ownerId = user.id;
  }

  // Generation is the most expensive AI call — gate it before any work starts.
  const limit = await checkRateLimit("finalize", ipFromHeaders(await headers()));
  if (!limit.ok) return { ok: false, error: rateLimitMessage(limit.retryAfterSec) };

  // hasLogo/hasPhotos are onboarding-flow flags (plan A5), not business facts —
  // strip them so they never reach generation or tenants.facts. Building from
  // the zod-parsed value also drops any unknown junk keys a client could send.
  const bizFacts: BusinessFacts = { ...parsedFacts.data };
  delete bizFacts.hasLogo;
  delete bizFacts.hasPhotos;

  try {
    const vId =
      verticalId ??
      classifyVertical(
        [bizFacts.businessName, bizFacts.about, ...(bizFacts.services?.map((s) => s.name) ?? [])]
          .filter(Boolean)
          .join(" "),
      );
    const host = await uniqueSubdomain(bizFacts.businessName);
    await generateAndPublish(bizFacts, host, vId, true, cleanMedia);
    const isProd = process.env.NODE_ENV === "production";
    const port = ROOT_DOMAIN.includes(":") ? `:${ROOT_DOMAIN.split(":")[1]}` : "";
    const url = `${isProd ? "https" : "http"}://${host}${isProd ? "" : port}`;

    // Ownership (§3.1, journal #43): the creator is signed in by the gate above,
    // so the tenant gets its owner immediately. (Auth off = open mode, no owner.)
    // Memory (P3): the onboarding conversation was created against a placeholder
    // tenant (host=null) — re-link it to the PUBLISHED tenant here, otherwise the
    // transcript is unreachable from the editor agent (validator must-fix #1).
    const sb = getServiceClient();
    const { data: t } = await sb.from("tenants").select("id").eq("host", host).maybeSingle();
    if (t) {
      if (ownerId) {
        await sb
          .from("tenant_members")
          .insert({ tenant_id: t.id, user_id: ownerId, role: "owner" });
      }
      if (conversationId) {
        await sb
          .from("conversations")
          .update({ tenant_id: t.id })
          .eq("id", conversationId);
      }
    }

    return { ok: true, host, url };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
