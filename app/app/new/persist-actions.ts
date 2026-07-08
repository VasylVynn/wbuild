"use server";

import { headers } from "next/headers";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { checkRateLimit, ipFromHeaders } from "@/lib/rate-limit";
import type { ChatMsg } from "@/lib/ai/onboard";

// Shape stored inside conversations.facts_state
type FactsState = {
  facts: unknown;
  verticalId: string | undefined;
  ready: boolean;
};

export type ConversationData = {
  messages: ChatMsg[];
  facts: unknown;
  verticalId: string | undefined;
  ready: boolean;
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
  const factsState: FactsState = { facts, verticalId, ready };

  const { error } = await db
    .from("conversations")
    .update({ messages, facts_state: factsState, is_complete: ready })
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
  };
}
