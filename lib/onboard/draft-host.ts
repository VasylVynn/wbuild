import "server-only";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";

// Shape stored inside conversations.facts_state — only the fields this module
// touches; the full shape lives in app/app/new/persist-actions.ts.
type FactsState = {
  facts: unknown;
  verticalId: string | undefined;
  ready: boolean;
  host?: string;
};

/**
 * Persists the DRAFT host into facts_state (draft-then-publish flow, 04 §2).
 * Merged so it survives later saveTurn writes; called by the generate flow
 * after the draft is generated. Best-effort, like the rest of persistence.
 *
 * Deliberately NOT a "use server" action (security review must-fix): as an
 * unauthenticated action any caller could write an arbitrary host into any
 * conversation, turning the claim gate into a membership oracle and letting
 * anyone bind a foreign tenant to their own conversation. Server-only module —
 * only the server-side generate flow may write this field.
 */
export async function saveDraftHost(
  conversationId: string,
  host: string,
): Promise<{ ok: boolean }> {
  if (!isSupabaseConfigured()) return { ok: false };
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
  const { error } = await db
    .from("conversations")
    .update({ facts_state: { ...fs, host } })
    .eq("id", conversationId);
  return { ok: !error };
}
