"use server";

import { headers } from "next/headers";
import { onboardTurn, type ChatMsg, type OnboardTurnResult } from "@/lib/ai/onboard";
import { uniqueSubdomain } from "@/lib/tenant/subdomain";
import { generateDraft, publishDraft } from "@/lib/site/publish";
import { classifyVertical } from "@/lib/verticals/registry";
import { buildDossierForConversation } from "@/lib/dossier";
import { getLatestSnapshot } from "@/lib/ig/snapshots";
import { checkRateLimit, ipFromHeaders, rateLimitMessage } from "@/lib/rate-limit";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { isAuthConfigured, getUser } from "@/lib/supabase/auth";
import { requireMember } from "@/lib/tenant/membership";
import { sanitizeMedia, type SiteMedia } from "@/lib/media/media";
import { businessFactsSchema, type BusinessFacts } from "@/lib/verticals/schema";
import { trackFunnel } from "@/lib/analytics/funnel";
import { createLogger } from "@/lib/log";
import { saveDraftHost } from "./persist-actions";

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

/** Strip onboarding-flow flags (plan A5) — never business facts, never generated. */
function toBusinessFacts(parsed: BusinessFacts): BusinessFacts {
  const bizFacts: BusinessFacts = { ...parsed };
  delete bizFacts.hasLogo;
  delete bizFacts.hasPhotos;
  if (bizFacts.services) bizFacts.services = bizFacts.services.filter((s) => s.name.trim());
  return bizFacts;
}

export type GenerateDraftResult =
  | { ok: true; host: string; previewUrl: string; editUrl: string }
  | { ok: false; error: string; authRequired?: true };

/**
 * Refactor 04 §2/§4: confirmed facts → generate a DRAFT (no publish) and return
 * a preview. Generation moved earlier (to "ready") so the owner confirms a real
 * site. The draft preview is the authed editor frame, so this also assigns
 * ownership + re-links the conversation now (both were at finalize before).
 */
export async function generateDraftAction(
  // Partial since W0 (plan C7): city/phone are no longer required inputs — the
  // backstop below checks name + contact channel and bridges the rest.
  facts: Partial<BusinessFacts>,
  verticalId?: string,
  media?: SiteMedia,
  conversationId?: string,
): Promise<GenerateDraftResult> {
  // Server-side backstop (adversarial review): a bypassed client must not reach
  // generation with a hollow facts object. W0 (plan C7): the requirement is
  // businessName + ANY contact channel (phone / telegram / instagram / viber) —
  // a phone-less site with IG-direct as the contact is legitimate (lead_form is
  // force-injected regardless, invariant 8).
  //
  // TODO(V2): businessFactsSchema still requires city/phone as z.string() and
  // generateSite parses dossier.facts strictly. Bridge until the V2 relax:
  // absent city/phone enter as "" — an empty string parses, and every renderer
  // simply omits the row (WireContacts `if (d.phone)`, footer `contact?.phone &&`,
  // groundHrefs routes tel: to #lead_form on empty digits).
  const parsedFacts = businessFactsSchema.safeParse({ city: "", phone: "", ...(facts ?? {}) });
  const contactChannel =
    parsedFacts.success &&
    [
      parsedFacts.data.phone,
      parsedFacts.data.telegram,
      parsedFacts.data.instagram,
      parsedFacts.data.viber,
    ].some((v) => typeof v === "string" && v.trim().length > 0);
  if (!parsedFacts.success || !parsedFacts.data.businessName.trim() || !contactChannel) {
    return {
      ok: false,
      error:
        "Бракує назви бізнесу або хоча б одного контакту (телефон, Instagram, Telegram чи Viber). Поверніться до розмови й додайте їх.",
    };
  }

  // Generation + the authed draft preview require a signed-in owner (§3.1,
  // journal #43): the tenant gets its owner at draft time; no anonymous drafts.
  let ownerId: string | null = null;
  if (isAuthConfigured()) {
    const user = await getUser();
    if (!user) return { ok: false, error: "Щоб створити сайт, спершу увійдіть.", authRequired: true };
    ownerId = user.id;
  }

  // Gate the expensive AI call before any work starts (per-tenant/IP).
  const limit = await checkRateLimit("onboard_generate", ipFromHeaders(await headers()));
  if (!limit.ok) return { ok: false, error: rateLimitMessage(limit.retryAfterSec) };

  const cleanMedia = sanitizeMedia(media);
  const bizFacts = toBusinessFacts(parsedFacts.data);

  // Named outside the try so a failure can be logged against the site it was for.
  let host = "";
  try {
    const snapshot = conversationId ? await getLatestSnapshot({ conversationId }) : null;
    const aboutText = [
      bizFacts.businessName,
      bizFacts.about,
      ...(bizFacts.services?.map((s) => s.name) ?? []),
    ]
      .filter(Boolean)
      .join(" ");
    const vId =
      verticalId ?? classifyVertical(aboutText, { igCategory: snapshot?.parsed.businessCategoryName });

    // Reuse the persisted draft host on re-generate (advances the design nonce =
    // «same data ⇒ different site», and avoids orphan draft tenants); else mint.
    let existingHost: string | undefined;
    if (conversationId && isSupabaseConfigured()) {
      const sb = getServiceClient();
      const { data } = await sb
        .from("conversations")
        .select("facts_state")
        .eq("id", conversationId)
        .maybeSingle();
      existingHost = (data?.facts_state as { host?: string } | null)?.host;
    }
    host = existingHost ?? (await uniqueSubdomain(bizFacts.businessName));

    const rawDossier = conversationId ? await buildDossierForConversation(conversationId) : null;
    // TODO(V2): same bridge as the backstop above — generateSite strict-parses
    // dossier.facts as full BusinessFacts (lib/ai/generate.ts), so absent
    // city/phone/businessName from the persisted facts_state must enter as the
    // confirmed value or "". Empty strings render nothing (verified: contacts
    // row, footer link and tel: grounding all skip falsy values).
    const dossier = rawDossier
      ? {
          ...rawDossier,
          facts: {
            businessName: bizFacts.businessName,
            city: "",
            phone: "",
            ...(rawDossier.facts ?? {}),
          },
        }
      : null;

    const res = await generateDraft({
      host,
      facts: bizFacts,
      verticalId: vId,
      media: cleanMedia,
      dossier: dossier ?? undefined,
    });
    if (!res.ok) return { ok: false, error: res.error ?? "Не вдалося згенерувати сайт." };

    // Ownership + transcript re-link now (the authed preview needs membership;
    // the editor/dossier need the transcript). Idempotent on re-generate.
    let tenantId: string | undefined;
    if (isSupabaseConfigured()) {
      const sb = getServiceClient();
      const { data: t } = await sb.from("tenants").select("id").eq("host", host).maybeSingle();
      if (t) {
        tenantId = t.id as string;
        if (ownerId) {
          const { data: mem } = await sb
            .from("tenant_members")
            .select("tenant_id")
            .eq("tenant_id", t.id)
            .eq("user_id", ownerId)
            .maybeSingle();
          if (!mem) {
            await sb.from("tenant_members").insert({ tenant_id: t.id, user_id: ownerId, role: "owner" });
          }
        }
        if (conversationId) {
          await sb.from("conversations").update({ tenant_id: t.id }).eq("id", conversationId);
        }
      }
    }

    if (conversationId) await saveDraftHost(conversationId, host);

    await trackFunnel("draft_generated", { tenantId, conversationId, meta: { host } });

    // Preview = the authed editor live-preview frame; editUrl = the full editor.
    return { ok: true, host, previewUrl: `/edit/${host}/frame`, editUrl: `/edit/${host}` };
  } catch (e) {
    log.error("draft generation failed", { host: host || undefined, error: e });
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
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
