import "server-only";
import { headers } from "next/headers";
import { uniqueSubdomain } from "@/lib/tenant/subdomain";
import { runPipeline, type PipelineStageEvent } from "@/lib/site/pipeline";
import { classifyVertical } from "@/lib/verticals/registry";
import { buildDossierForConversation } from "@/lib/dossier";
import { getLatestSnapshot } from "@/lib/ig/snapshots";
import { checkRateLimit, ipFromHeaders, rateLimitMessage } from "@/lib/rate-limit";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { isAuthConfigured, getUser } from "@/lib/supabase/auth";
import { sanitizeMedia, type SiteMedia } from "@/lib/media/media";
import { businessFactsSchema, type BusinessFacts } from "@/lib/verticals/schema";
import { hasContactChannel } from "@/lib/onboard/contact-channel";
import {
  CLAIMED_BY_OTHER_ERROR,
  CLAIM_CHECK_FAILED_ERROR,
  hasForeignMember,
} from "@/lib/onboard/claim-gate";
import { trackFunnel } from "@/lib/analytics/funnel";
import { saveDraftHost } from "@/lib/onboard/draft-host";
import { createLogger } from "@/lib/log";

const log = createLogger("generate-flow");

/**
 * The onboarding draft-generation flow (spec 2026-08-07 §7) — ONE module behind
 * both transports:
 *
 *   - `/api/generate` (SSE, primary): passes `onStage` so stage boundaries
 *     stream to the client and land in the `generation_progress` store.
 *   - `generateDraftAction` (non-stream fallback): calls this without it —
 *     one awaited result, exactly the pre-v2 behavior.
 *
 * Everything that used to live in generateDraftAction is here: the facts
 * backstop, the auth gate, the onboard_generate rate limit, host reuse/mint,
 * the M1 claim gate, the pipeline call, ownership + conversation re-link,
 * saveDraftHost and the funnel event. Both transports MUST keep passing
 * through this module so the gates can never diverge — which is why the claim
 * gate lives HERE, not in the route: a gate wired only into the SSE transport
 * would be bypassable via the directly-callable fallback action.
 */

export type GenerateDraftResult =
  | { ok: true; host: string; previewUrl: string; editUrl: string }
  | { ok: false; error: string; authRequired?: true };

/** Context the claim gate (M1, spec §7) decides on. */
export interface ClaimGateInput {
  host: string;
  /** Signed-in user id; null when the auth layer is off (degrade-open §3.1). */
  userId: string | null;
}
export type ClaimGateResult = { ok: true } | { ok: false; error: string };

/**
 * Atomically claim sole ownership of `tenantId` for `userId` — the DATABASE
 * arbitrates (security review must-fix): the partial unique index
 * `tenant_members_one_owner` (migration 0012, tenant_id where role='owner')
 * makes a second owner insert fail with 23505, so first COMMITTED claim wins.
 * The old app-side «insert → re-read → deterministic arbiter → loser deletes»
 * dance was racy: each racer arbitrated on its own READ COMMITTED snapshot,
 * which may not yet contain the other's uncommitted row — both could pass.
 *
 * On 23505 we re-read to tell OUR committed row (double-submit / composite-PK
 * dup — the claim stands) from a foreign winner (refuse honestly). Any
 * verification error fails CLOSED: this is an ownership gate, not a rate
 * limit — guessing open would hand the site over.
 */
async function claimTenantOwnership(tenantId: string, userId: string): Promise<ClaimGateResult> {
  const sb = getServiceClient();
  const { data: before, error: readErr } = await sb
    .from("tenant_members")
    .select("user_id")
    .eq("tenant_id", tenantId);
  if (readErr || !before) return { ok: false, error: CLAIM_CHECK_FAILED_ERROR };

  if (hasForeignMember(before.map((r) => r.user_id as string), userId)) {
    return { ok: false, error: CLAIMED_BY_OTHER_ERROR };
  }
  if (before.some((r) => r.user_id === userId)) return { ok: true }; // own re-generate

  const { error: insErr } = await sb
    .from("tenant_members")
    .insert({ tenant_id: tenantId, user_id: userId, role: "owner" });
  if (insErr) {
    if (insErr.code !== "23505") return { ok: false, error: CLAIM_CHECK_FAILED_ERROR };
    // 23505 = a committed row already exists — either our own (double-submit,
    // composite PK) or another user's owner row (the unique index fired). The
    // winner's row is committed, so this re-read is deterministic.
    const { data: after, error: afterErr } = await sb
      .from("tenant_members")
      .select("user_id")
      .eq("tenant_id", tenantId);
    if (afterErr || !after) return { ok: false, error: CLAIM_CHECK_FAILED_ERROR };
    if (after.some((r) => r.user_id === userId)) return { ok: true };
    log.warn("claim race lost", { tenantId, userId });
    return { ok: false, error: CLAIMED_BY_OTHER_ERROR };
  }
  return { ok: true };
}

/**
 * M1 claim gate (W2, plan §7-M1). Decides whether THIS signed-in user may
 * generate into `host` BEFORE any model spend. It lives in the SHARED flow so
 * both transports (SSE route AND the fallback action) pass through it — a
 * route-only gate would be bypassable by calling the action directly.
 *
 * Runs for EVERY host, minted or reused (security review must-fix): the old
 * `!existingHost` short-circuit assumed a freshly minted host can never point
 * at an existing tenant, but uniqueSubdomain's exhaustion fallback could
 * return a taken label — a genuinely fresh host simply finds no tenant row
 * below and passes anyway, so the shortcut bought nothing and opened a hole.
 *
 *  - Auth off / DB off → pass (degrade-open posture is §3.1's, unchanged).
 *  - Host's tenant claimed by another user → refuse honestly («Цей сайт уже
 *    привʼязаний до іншого акаунта») — the `?conv=` link is a bearer token,
 *    and its second holder must NOT become a co-owner.
 *  - Otherwise claim eagerly and atomically (see claimTenantOwnership).
 */
async function claimGateM1(input: ClaimGateInput): Promise<ClaimGateResult> {
  const { host, userId } = input;
  if (!userId || !isSupabaseConfigured()) return { ok: true };

  const sb = getServiceClient();
  const { data: tenant, error: tenantErr } = await sb
    .from("tenants")
    .select("id")
    .eq("host", host)
    .maybeSingle();
  if (tenantErr) return { ok: false, error: CLAIM_CHECK_FAILED_ERROR };
  if (!tenant) return { ok: true }; // fresh host — the pipeline will mint the row

  return claimTenantOwnership(tenant.id as string, userId);
}

export interface GenerateFlowInput {
  facts: Partial<BusinessFacts>;
  verticalId?: string;
  media?: SiteMedia;
  conversationId?: string;
  /** Stage-boundary notifications with the resolved host (the SSE transport
   *  keys progress rows and preview URLs by it). Absent on the fallback path. */
  onStage?: (host: string, event: PipelineStageEvent) => void | Promise<void>;
}

/** Strip onboarding-flow flags (plan A5) — never business facts, never generated. */
function toBusinessFacts(parsed: BusinessFacts): BusinessFacts {
  const bizFacts: BusinessFacts = { ...parsed };
  delete bizFacts.hasLogo;
  delete bizFacts.hasPhotos;
  if (bizFacts.services) bizFacts.services = bizFacts.services.filter((s) => s.name.trim());
  return bizFacts;
}

/**
 * Confirmed facts → generate a DRAFT (no publish) and return a preview
 * (refactor 04 §2/§4). Generation happens at "ready" so the owner confirms a
 * real site; the draft preview is the authed editor frame, so ownership and
 * the conversation re-link happen here too.
 */
export async function runGenerateFlow(input: GenerateFlowInput): Promise<GenerateDraftResult> {
  const { verticalId, conversationId } = input;

  // Server-side backstop (adversarial review): a bypassed client must not
  // reach generation with a hollow facts object. W0 (plan C7): the requirement
  // is businessName + ANY contact channel (phone / telegram / instagram /
  // viber). Since the V2 schema relax, absent city/phone parse as absent —
  // the W0 ""-bridge is gone; nothing downstream sees an invented value.
  const parsedFacts = businessFactsSchema.safeParse(input.facts ?? {});
  if (
    !parsedFacts.success ||
    !parsedFacts.data.businessName.trim() ||
    !hasContactChannel(parsedFacts.data)
  ) {
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

  const cleanMedia = sanitizeMedia(input.media);
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
    // The conversation's anchor tenant (startConversation's placeholder, later
    // re-pointed at the real tenant) rides along — it is the claim subject.
    let existingHost: string | undefined;
    let convTenantId: string | null = null;
    if (conversationId && isSupabaseConfigured()) {
      const sb = getServiceClient();
      const { data } = await sb
        .from("conversations")
        .select("tenant_id, facts_state")
        .eq("id", conversationId)
        .maybeSingle();
      convTenantId = (data?.tenant_id as string | null) ?? null;
      existingHost = (data?.facts_state as { host?: string } | null)?.host;
    }
    host = existingHost ?? (await uniqueSubdomain(bizFacts.businessName));

    // Claim the CONVERSATION, not just the host (security review must-fix):
    // startConversation always creates an anchor tenant, so the `?conv=`
    // bearer link is claimable from the very first authenticated generate —
    // BEFORE a draft host exists. Without this, a second link-holder could
    // generate the victim's dossier into their own tenant and re-bind the
    // conversation, locking the victim out of their own chat.
    if (ownerId && convTenantId && isSupabaseConfigured()) {
      const convClaim = await claimTenantOwnership(convTenantId, ownerId);
      if (!convClaim.ok) return { ok: false, error: convClaim.error };
    }

    // M1 claim gate (spec §7): decided BEFORE any model spend, in the shared
    // module so BOTH transports pass it — the fallback action can't fork the
    // policy. Refusals surface verbatim to the client (honest copy lives in
    // lib/onboard/claim-gate.ts).
    const gate = await claimGateM1({ host, userId: ownerId });
    if (!gate.ok) return { ok: false, error: gate.error };

    const rawDossier = conversationId ? await buildDossierForConversation(conversationId) : null;
    // generateSite strict-parses dossier.facts as BusinessFacts, and the
    // persisted facts_state may predate the name landing — the confirmed
    // businessName fills the gap. city/phone need no bridge since the V2
    // relax: absent facts stay absent (invariant 5 — omitted, never invented).
    const dossier = rawDossier
      ? {
          ...rawDossier,
          facts: {
            businessName: bizFacts.businessName,
            ...(rawDossier.facts ?? {}),
          },
        }
      : null;

    // Ownership + transcript re-link, idempotent. Runs at the S3 preview
    // boundary (below) AND as a post-pipeline backstop: the preview URL the
    // client gets at s3_done is the AUTHED editor frame, which 404s until the
    // tenant_members row exists — granting only after runPipeline (i.e. after
    // the whole S4 QA budget) left every first-time owner staring at a broken
    // preview for up to the full S4 window (review must-fix).
    const grantOwnershipAndLink = async (): Promise<string | undefined> => {
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
      return tenantId;
    };

    const res = await runPipeline({
      host,
      facts: bizFacts,
      verticalId: vId,
      media: cleanMedia,
      dossier: dossier ?? undefined,
      mode: "onboard",
      onStage: async (event: PipelineStageEvent) => {
        if (event.stage === "s3_compile" && event.status === "done") {
          // Membership BEFORE the transport announces the preview: the tenant
          // row exists as of the S3 write, and the s3_done event the route
          // derives from this boundary hands the client an authed frame URL.
          try {
            await grantOwnershipAndLink();
          } catch (e) {
            // The post-pipeline backstop retries; the preview may 404 until then.
            log.warn("ownership grant at preview boundary failed", { host, error: e });
          }
        }
        await input.onStage?.(host, event);
      },
    });
    if (!res.ok) return { ok: false, error: res.error ?? "Не вдалося згенерувати сайт." };

    // Idempotent backstop (also the fallback-action path, which has no stage
    // events): membership + re-link must exist even if the s3-boundary grant
    // failed transiently.
    const tenantId = await grantOwnershipAndLink();

    await trackFunnel("draft_generated", { tenantId, conversationId, meta: { host } });

    // Preview = the authed editor live-preview frame; editUrl = the full editor.
    return { ok: true, host, previewUrl: `/edit/${host}/frame`, editUrl: `/edit/${host}` };
  } catch (e) {
    log.error("draft generation failed", { host: host || undefined, error: e });
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
