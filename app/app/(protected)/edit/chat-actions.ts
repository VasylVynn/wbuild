"use server";

import { requireMember } from "@/lib/tenant/membership";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { EditorChatMsg } from "@/lib/ai/editor-agent";

/**
 * Editor-agent chat persistence reads (P3). Writes happen in the streaming
 * route (/api/editor-chat) after each turn; the UI only needs to load the
 * transcript on mount. Best-effort: without the 0006 migration (or Supabase)
 * this returns an empty history and the chat still works.
 */
export async function getEditorChatHistory(host: string): Promise<EditorChatMsg[]> {
  if (!isSupabaseConfigured()) return [];
  if (!(await requireMember({ host })).ok) return [];

  const sb = getServiceClient();
  const { data: t } = await sb.from("tenants").select("id").eq("host", host).maybeSingle();
  if (!t) return [];
  const { data } = await sb
    .from("editor_chats")
    .select("messages")
    .eq("tenant_id", t.id)
    .maybeSingle();
  const msgs = data?.messages as EditorChatMsg[] | null;
  return Array.isArray(msgs) ? msgs : [];
}
