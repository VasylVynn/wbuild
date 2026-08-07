import "server-only";
import { getServiceClient } from "@/lib/supabase/server";
import { publicSiteUrl } from "@/lib/config";
import type { BusinessFacts } from "@/lib/verticals/schema";
import type { SiteMedia } from "@/lib/media/media";
import type { Dossier } from "@/lib/dossier";
import { revalidateLiveHosts, runPipeline } from "@/lib/site/pipeline";
import { publishedFromDraft, type PageContent } from "@/lib/site/page-content";

/**
 * DRAFT/PUBLISH split (refactor 04 §4): generation lands in the DRAFT only —
 * the owner confirms a real preview, then publishDraft() promotes it.
 *
 * Since pipeline v2 the generation itself lives in lib/site/pipeline.ts
 * (staged S0–S4, §3/§6/§8/§9); generateDraft is the compatibility wrapper the
 * plain callers keep using (onboarding action, admin fixtures, dev smokes).
 * The /api/generate SSE transport calls runPipeline directly to stream stage
 * events.
 */

export async function generateDraft(opts: {
  host: string;
  facts: BusinessFacts;
  verticalId: string;
  media?: SiteMedia;
  // The rich per-business context (03 §1.5). Absent → a bare facts+media
  // dossier is built by the pipeline, so plain callers keep working with
  // deterministic fallbacks and no IG data.
  dossier?: Dossier;
}): Promise<{ ok: boolean; host: string; error?: string }> {
  const { ok, host, error } = await runPipeline({ ...opts, mode: "onboard" });
  return { ok, host, ...(error !== undefined && { error }) };
}

/**
 * Promote the draft to the live site: draft_content → published_content,
 * status "published", purge the tenant
 * cache (§5.5/§9.1). The ONLY path that publishes — human- (or admin-)
 * triggered, never called by an agent loop (invariant 6).
 *
 * FREE (owner decision 2026-08-06, superseding spec 2026-08-05 §3): going live
 * on our subdomain costs nothing, so there is no gate here at all. The ₴999 now
 * buys the CUSTOM DOMAIN — that gate lives in requestDomainAction
 * (app/app/new/domain-actions.ts), the one step the money is actually for.
 */
export async function publishDraft(
  host: string,
): Promise<{ ok: boolean; url: string; error?: string }> {
  const url = publicSiteUrl(host);
  try {
    const sb = getServiceClient();
    const { data: tenant, error: tErr } = await sb
      .from("tenants")
      .select("id")
      .eq("host", host)
      .maybeSingle();
    if (tErr || !tenant) {
      throw new Error(`tenant read failed: ${tErr?.message ?? "not found"}`);
    }

    const { data: page, error: pReadErr } = await sb
      .from("pages")
      .select("id, draft_content")
      .eq("tenant_id", tenant.id)
      .eq("slug", "")
      .maybeSingle();
    if (pReadErr || !page) throw new Error(`page read failed: ${pReadErr?.message ?? "not found"}`);

    const draft = (page.draft_content ?? {}) as PageContent;
    if (!draft.blocks?.length) throw new Error("draft is empty — generate before publishing");

    const { error: tUpdErr } = await sb
      .from("tenants")
      .update({ status: "published" })
      .eq("id", tenant.id);
    if (tUpdErr) throw new Error(`tenant publish failed: ${tUpdErr.message}`);

    // Design is promoted with the blocks it belongs to — publishing is the ONLY
    // moment the live site's look changes (invariant 6). genToken rides along
    // so a still-running image job can patch the published copy too.
    const { error: pUpdErr } = await sb
      .from("pages")
      .update({ published_content: publishedFromDraft(draft), is_published: true })
      .eq("id", page.id);
    if (pUpdErr) throw new Error(`page publish failed: ${pUpdErr.message}`);

    // Self-correction for the publish-vs-deferred-image race: if we copied a
    // draft whose gallery was still a pending placeholder, the image job may
    // have resolved the DRAFT (real images) right after our read but skipped
    // OUR published copy (it didn't exist when the job's published-CAS ran). We
    // are the last writer, so re-read the draft and, if it is now resolved,
    // re-copy — otherwise the job's later published-CAS fills it (published now
    // carries this token). Between them every interleaving resolves; a fresh
    // read gated by CAS on the token means we never clobber a newer generation.
    const publishedPending = (draft.blocks ?? []).some(
      (b) => b.type === "gallery" && (b.props.pendingImages ?? 0) > 0,
    );
    if (publishedPending && draft.genToken) {
      // Errors here are NOT swallowed: in this exact race a silent failure
      // would report publish success while the live site stays on shimmer.
      // Throw → the outer catch returns { ok:false }, and a retry republishes
      // the (by-then-resolved) draft cleanly.
      const { data: fresh, error: freshErr } = await sb
        .from("pages")
        .select("draft_content")
        .eq("id", page.id)
        .maybeSingle();
      if (freshErr) throw new Error(`publish self-correct read failed: ${freshErr.message}`);
      const freshDraft = (fresh?.draft_content ?? {}) as PageContent;
      const nowResolved =
        freshDraft.genToken === draft.genToken &&
        !(freshDraft.blocks ?? []).some(
          (b) => b.type === "gallery" && (b.props.pendingImages ?? 0) > 0,
        );
      if (nowResolved) {
        const { error: recopyErr } = await sb
          .from("pages")
          .update({ published_content: publishedFromDraft(freshDraft) })
          .eq("id", page.id)
          .eq("published_content->>genToken", draft.genToken);
        if (recopyErr) throw new Error(`publish self-correct re-copy failed: ${recopyErr.message}`);
      }
    }

    await revalidateLiveHosts(sb, tenant.id, host); // §5.5 / §9.1 purge-on-publish
    return { ok: true, url };
  } catch (e) {
    return { ok: false, url, error: e instanceof Error ? e.message : String(e) };
  }
}
