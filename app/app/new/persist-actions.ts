"use server";

import { headers } from "next/headers";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { checkRateLimit, ipFromHeaders } from "@/lib/rate-limit";
import type { ChatMsg } from "@/lib/ai/onboard";
import { mediaSchema, type SiteMedia } from "@/lib/media/media";

// Shape stored inside conversations.facts_state
type FactsState = {
  facts: unknown;
  verticalId: string | undefined;
  ready: boolean;
  // Owner-uploaded logo/photos (§4.8). Optional so pre-media rows stay valid.
  media?: SiteMedia;
};

export type ConversationData = {
  messages: ChatMsg[];
  facts: unknown;
  verticalId: string | undefined;
  ready: boolean;
  media: SiteMedia;
};

/**
 * Creates a placeholder tenant (host = null, status = demo) and a linked
 * conversations row. Returns null silently when Supabase is unconfigured so
 * the chat keeps working without persistence.
 */
export async function startConversation(): Promise<{ conversationId: string } | null> {
  if (!isSupabaseConfigured()) return null;

  // Caps placeholder-row creation per IP. Callers already tolerate null (the
  // chat continues without persistence), so a limited start degrades silently.
  const limit = await checkRateLimit("conversation_start", ipFromHeaders(await headers()));
  if (!limit.ok) return null;

  const db = getServiceClient();

  // Placeholder tenant — host nullable until subdomain chosen (data-model.md O1)
  const { data: tenant, error: tenantErr } = await db
    .from("tenants")
    .insert({ host: null, status: "demo", draft_theme: {}, brand: {} })
    .select("id")
    .single();

  if (tenantErr || !tenant) return null;

  const { data: conv, error: convErr } = await db
    .from("conversations")
    .insert({ tenant_id: tenant.id, messages: [], facts_state: {} })
    .select("id")
    .single();

  if (convErr || !conv) return null;

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
): Promise<{ ok: boolean }> {
  if (!isSupabaseConfigured()) return { ok: false };

  const db = getServiceClient();

  // Preserve any media saved out-of-band by saveMediaAction: a plain overwrite
  // of facts_state would wipe uploads if the owner keeps chatting after the
  // media step (e.g. after the login-gate resume).
  const { data: prev } = await db
    .from("conversations")
    .select("facts_state")
    .eq("id", conversationId)
    .maybeSingle();
  const media = (prev?.facts_state as FactsState | null)?.media;

  const factsState: FactsState = { facts, verticalId, ready, ...(media && { media }) };

  const { error } = await db
    .from("conversations")
    .update({ messages, facts_state: factsState, is_complete: ready })
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
  };

  const db = getServiceClient();
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

/**
 * Loads a persisted conversation by id. Returns null when Supabase is
 * unconfigured or the row is missing.
 */
export async function loadConversation(
  conversationId: string,
): Promise<ConversationData | null> {
  if (!isSupabaseConfigured()) return null;

  const db = getServiceClient();

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
    media: fs?.media ?? { photos: [] },
  };
}
