import type { SupabaseClient } from "@supabase/supabase-js";
import type { PageContent } from "@/lib/site/page-content";

/**
 * contentRev CAS for DRAFT writers (pipeline v2 §9).
 *
 * `genToken` identifies WHOSE generation a write belongs to; `contentRev` is
 * the monotonic VERSION of the draft row. Every async writer of the draft copy
 * (QA blocks, QA style, S4 patches, the deferred image job's draft patch) goes
 * through this helper: the UPDATE re-checks both at write time, so a stale
 * writer — one racing a newer generation OR a sibling writer of its own
 * generation — matches zero rows instead of resurrecting old content. The old
 * genToken-only CAS could not tell two writes of the SAME generation apart
 * (inspect.ts's naked block write was the review-critical hole).
 *
 * Pre-v2 rows have no contentRev: an expected rev of 0 matches NULL too
 * (coalesce semantics, spec §9 — otherwise NULL never matches and every writer
 * silently dies forever). Published-copy patches are NOT this helper's job —
 * they stay on the genToken CAS (published content never carries contentRev,
 * it is DRAFT_ONLY).
 *
 * No "server-only": vitest drives this against a plain structural mock.
 */

/** The client slice this helper needs — `Pick` of the SDK type (a hand-rolled
 *  structural interface sends tsc into TS2589 against Supabase's generics,
 *  same note as lib/design/seed.ts NonceClient). */
export type DraftCasClient = Pick<SupabaseClient, "from">;

export interface DraftCasKey {
  pageId: string;
  /** The generation this writer belongs to; omitted → identity not checked
   *  (only legitimate for writers that just read the row and patch blindly —
   *  prefer passing it). */
  genToken?: string;
  /** The contentRev the writer READ. 0 also matches a pre-v2 NULL. */
  contentRev: number;
}

export type DraftCasResult =
  | { ok: true; nextRev: number }
  | { ok: false; stale: boolean; error?: string };

/**
 * Compare-and-swap write of the whole draft content. On success the stored
 * row carries `contentRev = key.contentRev + 1` — callers chain further writes
 * off the returned `nextRev`. On `stale` the caller ABORTS (a newer writer
 * won); on `error` it aborts too — a swallowed error was exactly the
 * inspect.ts bug this helper replaces.
 */
export async function casUpdateDraft(
  sb: DraftCasClient,
  key: DraftCasKey,
  content: PageContent,
): Promise<DraftCasResult> {
  const nextRev = key.contentRev + 1;
  let q = sb
    .from("pages")
    .update({ draft_content: { ...content, contentRev: nextRev } })
    .eq("id", key.pageId);
  if (key.genToken) q = q.eq("draft_content->>genToken", key.genToken);
  q =
    key.contentRev === 0
      ? // coalesce(contentRev, 0) = 0 — PostgREST has no coalesce, so the OR
        // spells it out: NULL (pre-v2 row) or an explicit 0 both match.
        q.or("draft_content->>contentRev.is.null,draft_content->>contentRev.eq.0")
      : q.eq("draft_content->>contentRev", String(key.contentRev));
  const { data, error } = await q.select("id");
  if (error) return { ok: false, stale: false, error: error.message };
  if (!data?.length) return { ok: false, stale: true };
  return { ok: true, nextRev };
}

/** The rev a writer should CAS against after reading a draft row. */
export function readContentRev(draft: PageContent | null | undefined): number {
  const rev = draft?.contentRev;
  return typeof rev === "number" && Number.isFinite(rev) ? rev : 0;
}
