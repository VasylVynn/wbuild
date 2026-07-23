import "server-only";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { IgParsedProfile } from "./apify";

/**
 * Persistence for Instagram scrapes (refactor §1.1, table `ig_snapshots`). A
 * scrape is written server-side by the scrape route/tool itself — the old
 * ig-import flow streamed everything to the client as the ONLY copy and persisted
 * nothing. Multiple rows per conversation/tenant are fine (a re-scrape is a new
 * row); the dossier reads the latest.
 *
 * BEST-EFFORT (fail-open, like rate limits): the `0007_ig_snapshots` migration is
 * applied MANUALLY, so the table may not exist yet in a given environment. Every
 * path swallows its error with a console.warn and returns null — a missing table
 * must never take the scrape/onboarding flow down.
 */

export type IgSnapshot = {
  id: string;
  conversationId: string | null;
  tenantId: string | null;
  handle: string;
  raw: unknown;
  parsed: IgParsedProfile;
  scrapedAt: string;
};

/** Insert one snapshot row. Returns the new id, or null on any failure. */
export async function persistSnapshot(args: {
  conversationId?: string | null;
  tenantId?: string | null;
  handle: string;
  raw: unknown;
  parsed: IgParsedProfile;
}): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("ig_snapshots")
      .insert({
        conversation_id: args.conversationId ?? null,
        tenant_id: args.tenantId ?? null,
        handle: args.handle,
        raw: args.raw,
        parsed: args.parsed,
      })
      .select("id")
      .single();
    if (error) {
      console.warn(`[ig-snapshots] persist failed: ${error.message}`);
      return null;
    }
    return (data?.id as string) ?? null;
  } catch (e) {
    console.warn(`[ig-snapshots] persist threw: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

/** Latest snapshot for a conversation OR a tenant, or null if none/unavailable. */
export async function getLatestSnapshot(scope: {
  conversationId?: string | null;
  tenantId?: string | null;
}): Promise<IgSnapshot | null> {
  if (!isSupabaseConfigured()) return null;
  const conversationId =
    typeof scope.conversationId === "string" && scope.conversationId.trim()
      ? scope.conversationId.trim()
      : undefined;
  const tenantId =
    typeof scope.tenantId === "string" && scope.tenantId.trim() ? scope.tenantId.trim() : undefined;
  if (!conversationId && !tenantId) return null;

  try {
    const sb = getServiceClient();
    const base = sb
      .from("ig_snapshots")
      .select("id, conversation_id, tenant_id, handle, raw, parsed, scraped_at");
    const filtered = conversationId
      ? base.eq("conversation_id", conversationId)
      : base.eq("tenant_id", tenantId as string);
    const { data, error } = await filtered
      .order("scraped_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) {
      if (error) console.warn(`[ig-snapshots] read failed: ${error.message}`);
      return null;
    }
    return {
      id: data.id as string,
      conversationId: (data.conversation_id as string | null) ?? null,
      tenantId: (data.tenant_id as string | null) ?? null,
      handle: data.handle as string,
      raw: data.raw,
      parsed: data.parsed as IgParsedProfile,
      scrapedAt: data.scraped_at as string,
    };
  } catch (e) {
    console.warn(`[ig-snapshots] read threw: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}
