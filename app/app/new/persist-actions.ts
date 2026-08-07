"use server";

import { headers } from "next/headers";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { isAuthConfigured, getUser } from "@/lib/supabase/auth";
import { checkRateLimit, ipFromHeaders } from "@/lib/rate-limit";
import type { ChatMsg } from "@/lib/ai/onboard";
import { isStorageUrl, MAX_PHOTOS, mediaSchema, type SiteMedia } from "@/lib/media/media";
import { trackFunnel } from "@/lib/analytics/funnel";

// Shape stored inside conversations.facts_state
type FactsState = {
  facts: unknown;
  verticalId: string | undefined;
  ready: boolean;
  // A6: the user explicitly confirmed the chat summary. Optional so pre-A6
  // rows stay valid (absent = not confirmed).
  confirmed?: boolean;
  // B3: the design the agent picked in the chat. Optional so pre-B rows stay valid.
  // Owner-uploaded logo/photos (§4.8). Optional so pre-media rows stay valid.
  media?: SiteMedia;
  // Refactor 04 §2: the DRAFT host minted at generateDraftAction (draft-then-
  // publish flow). Persisted so a reload before publish can resume the preview.
  host?: string;
};

export type ConversationData = {
  messages: ChatMsg[];
  facts: unknown;
  verticalId: string | undefined;
  ready: boolean;
  confirmed: boolean;
  /** Resolved server-side so the client never bundles the template registry. */
  media: SiteMedia;
  /** Draft host, if a draft was already generated (draft-then-publish flow). */
  host?: string;
};

/** The conversation exists but is CLAIMED and the caller may not touch it:
 *  `auth` = no session (the owner may simply be signed out), `member` = signed
 *  in as someone who is not a member. */
export type ConversationLocked = { locked: "auth" | "member" };

/**
 * W2 (security review must-fix): the `?conv=` link is a bearer token, so once
 * a conversation's anchor tenant has been CLAIMED (the generate flow inserts
 * the owner membership before any model spend), the transcript, facts, media
 * and draft host stop being public. Before the claim (no members yet) the
 * bearer-link phase stays open, and with auth unconfigured everything degrades
 * open (§3.1). Verification errors fail closed.
 */
async function conversationAccess(
  db: ReturnType<typeof getServiceClient>,
  conversationId: string,
): Promise<{ ok: true } | ({ ok: false } & ConversationLocked)> {
  if (!isAuthConfigured()) return { ok: true }; // §3.1 degrade-open

  const { data, error } = await db
    .from("conversations")
    .select("tenant_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (error) return { ok: false, locked: "member" }; // fail closed
  const tenantId = (data?.tenant_id as string | null) ?? null;
  if (!tenantId) return { ok: true }; // no anchor tenant — nothing claimable

  const { data: members, error: memErr } = await db
    .from("tenant_members")
    .select("user_id")
    .eq("tenant_id", tenantId);
  if (memErr || !members) return { ok: false, locked: "member" }; // fail closed
  if (members.length === 0) return { ok: true }; // unclaimed — bearer phase

  const user = await getUser();
  if (!user) return { ok: false, locked: "auth" };
  return members.some((m) => m.user_id === user.id)
    ? { ok: true }
    : { ok: false, locked: "member" };
}

/**
 * Creates a placeholder tenant (host = null, status = demo) and a linked
 * conversations row. Returns null silently when Supabase is unconfigured so
 * the chat keeps working without persistence.
 */
export async function startConversation(
  // Funnel segmentation only (plan §3.4): which surface started the chat.
  // Untrusted client input — collapsed to the known values below.
  source?: "landing" | "new-page",
): Promise<{ conversationId: string } | null> {
  if (!isSupabaseConfigured()) return null;

  // Caps placeholder-row creation per IP. Callers already tolerate null (the
  // chat continues without persistence), so a limited start degrades silently.
  const limit = await checkRateLimit("conversation_start", ipFromHeaders(await headers()));
  if (!limit.ok) return null;

  const db = getServiceClient();

  // Placeholder tenant — host nullable until subdomain chosen (data-model.md O1)
  const { data: tenant, error: tenantErr } = await db
    .from("tenants")
    .insert({ host: null, status: "demo", brand: {} })
    .select("id")
    .single();

  if (tenantErr || !tenant) return null;

  const { data: conv, error: convErr } = await db
    .from("conversations")
    .insert({ tenant_id: tenant.id, messages: [], facts_state: {} })
    .select("id")
    .single();

  if (convErr || !conv) return null;

  // Top of the funnel: this row is created on the first real user message, so it
  // counts people who started talking, not people who loaded /new.
  // meta.source segments landing-hero chats vs the app./new page (plan §3.4).
  const src = source === "landing" ? "landing" : "new-page";
  await trackFunnel("chat_start", {
    tenantId: tenant.id,
    conversationId: conv.id,
    meta: { source: src },
  });

  return { conversationId: conv.id };
}

/**
 * Persists the latest conversation state. Designed for fire-and-forget callers
 * (void saveTurn(...)) — UI never blocks on this.
 */
export async function saveTurn(
  conversationId: string,
  messages: ChatMsg[],
  facts: unknown,
  verticalId: string | undefined,
  ready: boolean,
  confirmed = false,
  // Wave G (codex review): the chat-upload flow persists messages AND media in
  // this ONE write — two racing read-modify-writes (saveTurn + saveMediaAction)
  // could lose the just-uploaded photo. Untrusted client input, validated
  // below; invalid/absent → fall back to preserving what's stored.
  media?: unknown,
): Promise<{ ok: boolean }> {
  if (!isSupabaseConfigured()) return { ok: false };

  const db = getServiceClient();
  const access = await conversationAccess(db, conversationId);
  if (!access.ok) return { ok: false };

  // Message attachments are client-supplied storage URLs (composer photo
  // batches). Defense in depth: only our-bucket URLs persist (§4.8).
  const cleanMessages: ChatMsg[] = messages.map((m) => {
    const atts = m.attachments?.filter(isStorageUrl).slice(0, MAX_PHOTOS);
    return { role: m.role, content: m.content, ...(atts?.length && { attachments: atts }) };
  });

  const mediaParsed = media !== undefined ? mediaSchema.safeParse(media) : null;
  const cleanMedia: SiteMedia | undefined = mediaParsed?.success
    ? {
        ...(mediaParsed.data.logoUrl && { logoUrl: mediaParsed.data.logoUrl }),
        photos: mediaParsed.data.photos,
        ...(mediaParsed.data.photoMeta?.length && { photoMeta: mediaParsed.data.photoMeta }),
      }
    : undefined;

  // Preserve any media saved out-of-band by saveMediaAction: a plain overwrite
  // of facts_state would wipe uploads if the owner keeps chatting after the
  // media step (e.g. after the login-gate resume). The caller-provided media
  // (validated above) wins over the stored value.
  const { data: prev } = await db
    .from("conversations")
    .select("facts_state")
    .eq("id", conversationId)
    .maybeSingle();
  const storedMedia = (prev?.facts_state as FactsState | null)?.media;
  const mediaFinal = cleanMedia ?? storedMedia;

  // Unknown/absent template ids are dropped (registry is the authority); the
  // stored pick only changes when this turn carries a valid one — a refusal
  // turn that lost the client-side pick must not wipe the persisted choice.

  // The draft host is written out-of-band by saveDraftHost; a plain turn write
  // must preserve it (same reasoning as media above).
  const prevHost = (prev?.facts_state as FactsState | null)?.host;

  const factsState: FactsState = {
    facts,
    verticalId,
    ready,
    confirmed,
    ...(mediaFinal && { media: mediaFinal }),
    ...(prevHost && { host: prevHost }),
  };

  const { error } = await db
    .from("conversations")
    .update({ messages: cleanMessages, facts_state: factsState, is_complete: ready })
    .eq("id", conversationId);

  return { ok: !error };
}

/**
 * Persists onboarding media (logo + photos) into facts_state, merged so it
 * survives later saveTurn writes. Fire-and-forget from the client: called on
 * every upload/clear, so uploads outlive the login-gate redirect. Untrusted
 * input is validated (≤3 photos, every URL under our Storage bucket); invalid
 * media is rejected without touching the row.
 */
export async function saveMediaAction(
  conversationId: string,
  media: unknown,
): Promise<{ ok: boolean }> {
  if (!isSupabaseConfigured()) return { ok: false };

  const parsed = mediaSchema.safeParse(media);
  if (!parsed.success) return { ok: false };
  const clean: SiteMedia = {
    ...(parsed.data.logoUrl && { logoUrl: parsed.data.logoUrl }),
    photos: parsed.data.photos,
    ...(parsed.data.photoMeta?.length && { photoMeta: parsed.data.photoMeta }),
  };

  const db = getServiceClient();
  const access = await conversationAccess(db, conversationId);
  if (!access.ok) return { ok: false };

  const { data, error: readErr } = await db
    .from("conversations")
    .select("facts_state")
    .eq("id", conversationId)
    .maybeSingle();
  if (readErr || !data) return { ok: false };

  const fs = (data.facts_state as FactsState | null) ?? {
    facts: {},
    verticalId: undefined,
    ready: false,
  };
  const next: FactsState = { ...fs, media: clean };

  const { error } = await db
    .from("conversations")
    .update({ facts_state: next })
    .eq("id", conversationId);

  return { ok: !error };
}

// saveDraftHost moved to lib/onboard/draft-host.ts (security review must-fix):
// as an unauthenticated "use server" action it let any caller write an
// arbitrary host into any conversation — the exact field the claim gate then
// trusted as its authorization subject. Server-only now; only the generate
// flow writes it.

/**
 * Loads a persisted conversation by id. Returns null when Supabase is
 * unconfigured or the row is missing, and a `{ locked }` marker when the
 * conversation is claimed and the caller may not read it (W2 — the transcript,
 * facts, media and draft host must not leak to a bearer-link holder).
 */
export async function loadConversation(
  conversationId: string,
): Promise<ConversationData | ConversationLocked | null> {
  if (!isSupabaseConfigured()) return null;

  const db = getServiceClient();
  const access = await conversationAccess(db, conversationId);
  if (!access.ok) return { locked: access.locked };

  const { data, error } = await db
    .from("conversations")
    .select("messages, facts_state")
    .eq("id", conversationId)
    .single();

  if (error || !data) return null;

  const fs = data.facts_state as FactsState | null;


  return {
    messages: (data.messages as ChatMsg[]) ?? [],
    facts: fs?.facts ?? {},
    verticalId: fs?.verticalId,
    ready: fs?.ready ?? false,
    confirmed: fs?.confirmed ?? false,
    media: fs?.media ?? { photos: [] },
    ...(fs?.host && { host: fs.host }),
  };
}
