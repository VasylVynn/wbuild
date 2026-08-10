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
 *
 * ── PROVENANCE CONTRACT (live audit 2026-08-10) ────────────────────────────────
 * A snapshot starts life on a CONVERSATION (onboarding scrape: no tenant exists
 * yet) and must end up on the TENANT, because everything that verifies whether
 * generated content is real — editor regeneration, the tenant dossier, admin
 * provenance checks — is keyed by tenant. That promotion was documented but never
 * implemented, so every row in production carried `tenant_id = NULL` and a
 * tenant-keyed read silently returned nothing. Three layers now close it:
 *
 *   1. WRITE  — `persistSnapshot` is given a REAL tenant id whenever one exists
 *               (`realTenantIdForConversation`, see below).
 *   2. LINK   — `linkSnapshotsToTenant` runs in the same place the CONVERSATION is
 *               re-linked to the tenant (lib/onboard/generate-flow.ts).
 *   3. READ   — `getLatestSnapshot` resolves by tenant OR by the tenant's
 *               conversations, so a row that missed 1 and 2 is still found.
 *
 * Layer 3 is the one that must never be removed: it is what makes the other two
 * best-effort rather than load-bearing.
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

/** The DB row shape, snake_case, as selected below. */
type SnapshotRow = {
  id: string;
  conversation_id: string | null;
  tenant_id: string | null;
  handle: string;
  raw: unknown;
  parsed: unknown;
  scraped_at: string;
};

const SNAPSHOT_COLUMNS = "id, conversation_id, tenant_id, handle, raw, parsed, scraped_at";

function trimmed(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

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

/** Just enough of a row to order candidates — the pure picker's input. */
export type SnapshotOrderKey = { id: string; tenant_id: string | null; scraped_at: string };

/**
 * Ordering rule for snapshot candidates gathered from more than one scope.
 * PURE + exported so the resolution order is unit-testable without a DB.
 *
 *   1. newest `scraped_at` wins (an unparseable timestamp sorts last, never first
 *      — a corrupt row must not shadow a good one);
 *   2. tie → the TENANT-linked row wins (it is the promoted, canonical copy);
 *   3. still tied → lowest id, so the choice is deterministic across replicas.
 */
function compareSnapshotCandidates(a: SnapshotOrderKey, b: SnapshotOrderKey): number {
  const ta = Date.parse(a.scraped_at);
  const tb = Date.parse(b.scraped_at);
  const va = Number.isFinite(ta) ? ta : Number.NEGATIVE_INFINITY;
  const vb = Number.isFinite(tb) ? tb : Number.NEGATIVE_INFINITY;
  if (va !== vb) return vb > va ? 1 : -1;
  const la = a.tenant_id ? 0 : 1;
  const lb = b.tenant_id ? 0 : 1;
  if (la !== lb) return la - lb;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Newest snapshot among candidates from several scopes; dedupes by id. */
export function pickNewestSnapshot<T extends SnapshotOrderKey>(rows: readonly T[]): T | null {
  let best: T | null = null;
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row || typeof row.id !== "string" || seen.has(row.id)) continue;
    seen.add(row.id);
    if (!best || compareSnapshotCandidates(row, best) < 0) best = row;
  }
  return best;
}

/**
 * Latest snapshot for a conversation OR a tenant — and, crucially, for a tenant
 * VIA its conversations. A tenant-keyed caller (editor chat, regeneration, admin)
 * used to get `null` for every site onboarded before the promotion existed; it now
 * fans out to the tenant's conversation ids and takes the newest of both scopes.
 * Returns null if nothing is found or the table is unavailable (fail-open).
 */
export async function getLatestSnapshot(scope: {
  conversationId?: string | null;
  tenantId?: string | null;
}): Promise<IgSnapshot | null> {
  if (!isSupabaseConfigured()) return null;
  const conversationId = trimmed(scope.conversationId);
  const tenantId = trimmed(scope.tenantId);
  if (!conversationId && !tenantId) return null;

  try {
    const sb = getServiceClient();

    // Conversation scope = the one we were handed PLUS every conversation that
    // belongs to the tenant (indexed by conversations_tenant_idx, migration 0001).
    const conversationIds = new Set<string>();
    if (conversationId) conversationIds.add(conversationId);
    if (tenantId) {
      const { data: convs, error: convErr } = await sb
        .from("conversations")
        .select("id")
        .eq("tenant_id", tenantId);
      if (convErr) console.warn(`[ig-snapshots] conversation fan-out failed: ${convErr.message}`);
      for (const c of convs ?? []) {
        const id = trimmed((c as { id?: unknown }).id);
        if (id) conversationIds.add(id);
      }
    }

    // One indexed «newest» probe per scope, then the pure picker decides. Two
    // narrow queries beat one `.or()` string: both hit an existing composite
    // index (…_tenant_idx / …_conversation_idx) and neither can be broken by
    // PostgREST filter-string quoting.
    const probes: PromiseLike<{ data: unknown; error: { message: string } | null }>[] = [];
    if (tenantId) {
      probes.push(
        sb
          .from("ig_snapshots")
          .select(SNAPSHOT_COLUMNS)
          .eq("tenant_id", tenantId)
          .order("scraped_at", { ascending: false })
          .limit(1),
      );
    }
    if (conversationIds.size) {
      probes.push(
        sb
          .from("ig_snapshots")
          .select(SNAPSHOT_COLUMNS)
          .in("conversation_id", [...conversationIds])
          .order("scraped_at", { ascending: false })
          .limit(1),
      );
    }
    if (!probes.length) return null;

    const results = await Promise.all(probes);
    const rows: SnapshotRow[] = [];
    for (const r of results) {
      if (r.error) console.warn(`[ig-snapshots] read failed: ${r.error.message}`);
      if (Array.isArray(r.data)) rows.push(...(r.data as SnapshotRow[]));
    }

    const data = pickNewestSnapshot(rows);
    if (!data) return null;
    return {
      id: data.id,
      conversationId: data.conversation_id ?? null,
      tenantId: data.tenant_id ?? null,
      handle: data.handle,
      raw: data.raw,
      parsed: data.parsed as IgParsedProfile,
      scrapedAt: data.scraped_at,
    };
  } catch (e) {
    console.warn(`[ig-snapshots] read threw: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

/**
 * Promote a conversation's snapshots to the tenant that conversation now belongs
 * to. Called from the SAME place the conversation itself is re-linked
 * (lib/onboard/generate-flow.ts → grantOwnershipAndLink), so provenance and
 * ownership land together or not at all.
 *
 * Only `tenant_id IS NULL` rows are touched: a row already promoted (possibly to
 * a DIFFERENT tenant, e.g. a conversation reused across two sites) is never
 * re-pointed. That makes the call idempotent and safe to run on every generate.
 * Returns the number of promoted rows, or null when unavailable (fail-open —
 * this must never fail a generation).
 */
export async function linkSnapshotsToTenant(args: {
  conversationId: string;
  tenantId: string;
}): Promise<number | null> {
  if (!isSupabaseConfigured()) return null;
  const conversationId = trimmed(args.conversationId);
  const tenantId = trimmed(args.tenantId);
  if (!conversationId || !tenantId) return null;
  try {
    const sb = getServiceClient();
    const { data, error } = await sb
      .from("ig_snapshots")
      .update({ tenant_id: tenantId })
      .eq("conversation_id", conversationId)
      .is("tenant_id", null)
      .select("id");
    if (error) {
      console.warn(`[ig-snapshots] tenant link failed: ${error.message}`);
      return null;
    }
    return Array.isArray(data) ? data.length : 0;
  } catch (e) {
    console.warn(`[ig-snapshots] tenant link threw: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

/**
 * The conversation's tenant, but ONLY when it is a real site (host set).
 *
 * `startConversation` creates an ANCHOR tenant (host = null, status = demo) up
 * front, and generation later re-points the conversation at the tenant minted for
 * the chosen host. Stamping a snapshot with the anchor id would therefore write a
 * link that is wrong the moment the site is generated — worse than a NULL, since
 * `linkSnapshotsToTenant` deliberately refuses to overwrite a non-null tenant.
 * Gating on `host IS NOT NULL` is what makes «stamp at insert» safe: before the
 * first generate it returns null (the LINK layer covers it), after it returns the
 * real tenant (so re-scrapes are born correctly linked).
 */
export async function realTenantIdForConversation(
  conversationId: string,
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const id = trimmed(conversationId);
  if (!id) return null;
  try {
    const sb = getServiceClient();
    const { data: conv, error: convErr } = await sb
      .from("conversations")
      .select("tenant_id")
      .eq("id", id)
      .maybeSingle();
    if (convErr) {
      console.warn(`[ig-snapshots] conversation tenant read failed: ${convErr.message}`);
      return null;
    }
    const tenantId = trimmed((conv as { tenant_id?: unknown } | null)?.tenant_id);
    if (!tenantId) return null;

    const { data: tenant, error: tenantErr } = await sb
      .from("tenants")
      .select("host")
      .eq("id", tenantId)
      .maybeSingle();
    if (tenantErr) {
      console.warn(`[ig-snapshots] tenant host read failed: ${tenantErr.message}`);
      return null;
    }
    return trimmed((tenant as { host?: unknown } | null)?.host) ? tenantId : null;
  } catch (e) {
    console.warn(
      `[ig-snapshots] conversation tenant resolve threw: ${e instanceof Error ? e.message : String(e)}`,
    );
    return null;
  }
}
