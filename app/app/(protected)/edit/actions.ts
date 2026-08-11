"use server";

import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { requireMember } from "@/lib/tenant/membership";
import { parseBlockProps, type StoredBlock } from "@/lib/blocks/schema";
import { blockPlacementSchema } from "@/lib/blocks/schema";
import { getBlockFields } from "@/lib/blocks/fields";
import { getVertical } from "@/lib/verticals/registry";
import { draftPhotoUrls, sanitizeMedia, type PhotoMeta, type SiteMedia } from "@/lib/media/media";
import type { BusinessFacts } from "@/lib/verticals/schema";
import { type PageSeo } from "@/lib/tenant/types";
import type { PageContent } from "@/lib/site/page-content";
import type { DesignSpec } from "@/lib/site/design-spec";
import type { BrandLogoSource } from "@/lib/templates/brand";
import { publishDraft } from "@/lib/site/publish";
import { runPipeline } from "@/lib/site/pipeline";
import { casUpdateDraft, readContentRev } from "@/lib/site/draft-cas";
import { trackFunnel } from "@/lib/analytics/funnel";

/** Human draft writers CAS like every other writer (spec §9): a save racing a
 *  still-running S4/QA (or a parallel editor tab) must surface, not silently
 *  lose — a spread without a rev bump let S4's CAS still match and write back
 *  its pre-edit snapshot over the owner's change. */
const STALE_DRAFT_ERROR =
  "Чернетка щойно змінилася (йде генерація або паралельне редагування). Оновіть сторінку й спробуйте ще раз.";

/**
 * Editor server actions (§3 + §5.5): the editor reads/writes DRAFT only;
 * «Опублікувати» promotes draft→published in one step and purges the tenant
 * cache. Blocks are validated against the registry before every write.
 */

export interface EditorData {
  tenantId: string;
  host: string;
  businessName: string;
  verticalId: string;
  status: string;
  /** Has this site ever been published? Derived from the PAGE, not from
   *  `tenants.status`: publishing writes `pages.published_content`, and that
   *  row is the only thing a visitor can actually load. An owner who has not
   *  published must be told so plainly — the editor renders the draft, which
   *  looks exactly like a live site and says nothing about being invisible. */
  published: boolean;
  blocks: StoredBlock[];
  telegramConnected: boolean;
  // The wireframe this draft was composed against — the preview renders through
  // its OWN section components + wrapper, matching the published site.
  templateId?: string;
  // The tenant's whole logo record (original + adapted + the measured plate).
  // Passed through unresolved so the preview runs the SAME resolution as the
  // public site (buildTemplateBrand → resolveDisplayLogo) instead of a second
  // copy of the rule that could drift.
  displayLogo?: BrandLogoSource;
  // The model-written stylesheet for this draft. The frame preview must read the
  // DRAFT's design, or it shows a bare grey wireframe while the site is styled.
  wireCss?: string;
  // The DRAFT's design brief (pipeline v2 §3): the frame preview renders the
  // draft's own typography/motion, exactly like the published site will.
  designSpec?: DesignSpec;
  // Draft page SEO meta (wave D) — shown to the editor agent; goes live on publish.
  seo?: PageSeo;
}

export async function getEditorData(host: string): Promise<EditorData | null> {
  // Ownership gate (§3.1): a non-member gets null → the page 404s.
  if (!(await requireMember({ host })).ok) return null;
  const sb = getServiceClient();
  const { data: t } = await sb
    .from("tenants")
    .select("id, host, brand, vertical, status, telegram_chat_id")
    .eq("host", host)
    .maybeSingle();
  if (!t) return null;

  const { data: p } = await sb
    .from("pages")
    .select("draft_content, published_content")
    .eq("tenant_id", t.id)
    .eq("slug", "")
    .maybeSingle();

  const vertical = getVertical(t.vertical);
  return {
    tenantId: t.id,
    host: t.host,
    businessName: (t.brand as { businessName?: string } | null)?.businessName ?? t.host,
    verticalId: vertical.id,
    status: t.status,
    published: p?.published_content != null,
    blocks: ((p?.draft_content as { blocks?: StoredBlock[] } | null)?.blocks ?? []) as StoredBlock[],
    telegramConnected: Boolean(t.telegram_chat_id),
    templateId: (p?.draft_content as { templateId?: string } | null)?.templateId,
    wireCss: (p?.draft_content as { wireCss?: string } | null)?.wireCss,
    designSpec: (p?.draft_content as { designSpec?: DesignSpec } | null)?.designSpec,
    displayLogo: (t.brand ?? undefined) as BrandLogoSource | undefined,
    seo: (p?.draft_content as { seo?: PageSeo } | null)?.seo,
  };
}

// Same ceilings as generation (lib/ai/generate.ts clampSeo) — search engines
// truncate around 60/150; these are the hard persistence caps.
const SEO_TITLE_MAX = 70;
const SEO_DESCRIPTION_MAX = 170;

/**
 * Save the page SEO meta into the DRAFT (wave D5). Merge semantics: an absent
 * field keeps the current value, an empty string clears it. Draft-only — NO
 * cache purge; «Опублікувати» promotes draft_content.seo with everything else.
 */
export async function saveDraftSeo(
  host: string,
  patch: { title?: string; description?: string },
): Promise<{ ok: boolean; seo?: PageSeo; error?: string }> {
  try {
    const gate = await requireMember({ host }); // §3.1
    if (!gate.ok) return { ok: false, error: gate.error };
    const sb = getServiceClient();
    const { data: t } = await sb.from("tenants").select("id").eq("host", host).maybeSingle();
    if (!t) return { ok: false, error: "tenant not found" };
    const { data: p } = await sb
      .from("pages")
      .select("id, draft_content")
      .eq("tenant_id", t.id)
      .eq("slug", "")
      .maybeSingle();
    if (!p) return { ok: false, error: "page not found" };

    const draft = (p.draft_content ?? {}) as PageContent;
    const current = draft.seo ?? {};
    const next: PageSeo = { ...current };
    if (patch.title !== undefined) {
      const title = patch.title.trim().slice(0, SEO_TITLE_MAX).trim();
      if (title) next.title = title;
      else delete next.title;
    }
    if (patch.description !== undefined) {
      const description = patch.description.trim().slice(0, SEO_DESCRIPTION_MAX).trim();
      if (description) next.description = description;
      else delete next.description;
    }

    const hasSeo = Boolean(next.title || next.description);
    // Spread, don't rebuild: this action owns `seo` and nothing else. Listing
    // the fields by hand is how a draft save silently dropped the site's
    // design (templateId/wireCss) and the image job's genToken. CAS'd on
    // genToken + contentRev (§9) so a concurrent S4 writer detects the bump.
    const cas = await casUpdateDraft(
      sb,
      {
        pageId: p.id as string,
        ...(draft.genToken && { genToken: draft.genToken }),
        contentRev: readContentRev(draft),
      },
      { ...draft, ...(hasSeo ? { seo: next } : { seo: undefined }) },
    );
    if (!cas.ok) return { ok: false, error: cas.stale ? STALE_DRAFT_ERROR : cas.error };
    return { ok: true, seo: hasSeo ? next : undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * §4.8 invariant, now enforced on the DRAFT-SAVE path too (adversarial-review
 * must-fix): any image field whose URL is not our own Storage gets stripped.
 * Generation already grounds images; this closes the editor/agent write path,
 * where props land in the draft without a human-reviewed form in between.
 */
function allowedImageUrl(url: string): boolean {
  if (!url) return true; // empty = "no image", always fine
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return Boolean(supabase && url.startsWith(`${supabase}/storage/`));
}

function stripForeignImages(type: StoredBlock["type"], props: unknown): unknown {
  if (!props || typeof props !== "object") return props;
  const fields = getBlockFields(type);
  const out = { ...(props as Record<string, unknown>) };
  for (const f of fields) {
    if (f.kind === "image") {
      const v = out[f.key];
      if (typeof v === "string" && !allowedImageUrl(v)) out[f.key] = "";
    } else if (f.kind === "array" && Array.isArray(out[f.key])) {
      out[f.key] = (out[f.key] as Record<string, unknown>[]).map((item) => {
        if (!item || typeof item !== "object") return item;
        const next = { ...item };
        for (const inner of f.itemFields) {
          if (inner.kind === "image") {
            const v = next[inner.key];
            if (typeof v === "string" && !allowedImageUrl(v)) next[inner.key] = "";
          }
        }
        return next;
      });
    }
  }
  return out;
}

/** Validate each block against the registry; throw on structural garbage. */
function validateBlocks(blocks: StoredBlock[]): StoredBlock[] {
  return blocks.map((b) => {
    const parsed = parseBlockProps(b.type, stripForeignImages(b.type, b.props));
    if (!parsed.ok) {
      throw new Error(`Invalid block "${b.type}": ${"message" in parsed.error ? parsed.error.message : "schema mismatch"}`);
    }
    const placement = blockPlacementSchema.parse({
      anchor: b.anchor,
      navLabel: b.navLabel,
      showInNav: b.showInNav ?? false,
      hidden: b.hidden ?? false,
      // The wireframe `section` this block fills must round-trip, or the site
      // loses its look on the first edit.
      section: b.section,
      // `variant` (the model-chosen layout) must round-trip too, or the first
      // draft save silently reverts every section to its default layout.
      variant: b.variant,
      schemaVersion: b.schemaVersion,
    });
    return { type: parsed.type, props: parsed.props, ...placement } as StoredBlock;
  });
}

export async function saveDraftBlocks(
  host: string,
  blocks: StoredBlock[],
): Promise<{ ok: boolean; error?: string }> {
  try {
    const gate = await requireMember({ host }); // §3.1
    if (!gate.ok) return { ok: false, error: gate.error };
    const valid = validateBlocks(blocks);
    const sb = getServiceClient();
    const { data: t } = await sb.from("tenants").select("id").eq("host", host).maybeSingle();
    if (!t) return { ok: false, error: "tenant not found" };
    const { data: p } = await sb
      .from("pages")
      .select("id, draft_content")
      .eq("tenant_id", t.id)
      .eq("slug", "")
      .maybeSingle();
    if (!p) return { ok: false, error: "page not found" };
    const draft = (p.draft_content ?? {}) as PageContent;
    // `seo` (wave D1) must round-trip a block save, like pocket — dropping it
    // here would silently erase the page meta on the first manual edit.
    // Same rule as saveDraftSeo: this action owns `blocks`, so everything
    // else on the draft — design, pocket, seo, genToken — rides through.
    // CAS'd (§9): without the rev bump an S4 write racing this save silently
    // reverted the owner's blocks with its own pre-edit snapshot.
    const cas = await casUpdateDraft(
      sb,
      {
        pageId: p.id as string,
        ...(draft.genToken && { genToken: draft.genToken }),
        contentRev: readContentRev(draft),
      },
      { ...draft, blocks: valid },
    );
    if (!cas.ok) return { ok: false, error: cas.stale ? STALE_DRAFT_ERROR : cas.error };
    return { ok: true }; // draft save NEVER purges the cache (§5.5)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * «Згенерувати ще раз» (§3 п.5 / §4.7): re-run generation from the tenant's
 * FACTS into the draft — a new composition AND a new stylesheet. The previous
 * draft blocks go to the pocket (never deleted).
 *
 * Since pipeline v2 the whole staged run — seeded axes + tuple guard, S1 brief,
 * parallel composition/stylesheet, lint-before-persist, the §8 editor write
 * contract (pocket accumulation, minted genToken, oldDraft spread), CAS'd
 * style-audit QA — lives in lib/site/pipeline.ts. This action is the ownership
 * gate + the media assembly around `runPipeline(mode: "editor")`. The editor
 * run now carries the same 240s chain deadline as generation (owner decision
 * v2 Q6 — it used to be unbounded).
 */
export async function regenerateSite(
  host: string,
): Promise<{ ok: boolean; blocks?: StoredBlock[]; error?: string }> {
  try {
    const gate = await requireMember({ host }); // §3.1
    if (!gate.ok) return { ok: false, error: gate.error };
    const sb = getServiceClient();
    const { data: t } = await sb
      .from("tenants")
      .select("id, facts, vertical, brand")
      .eq("host", host)
      .maybeSingle();
    if (!t) return { ok: false, error: "tenant not found" };

    // What the owner has ACTUALLY curated: the photos standing in the draft
    // right now. They may have arrived through the editor chat or a block form,
    // neither of which writes tenants.brand.photos — so reading brand alone
    // rebuilt the site from the onboarding import and deleted the owner's work.
    // FAILS CLOSED. An unread draft is not «no curated photos» — it is «we do
    // not know», and proceeding on that would rebuild the site from the stale
    // brand list and delete the owner's photos silently: the exact loss this
    // read exists to prevent, now with no error to see. A missing ROW is a
    // different answer and a legitimate one (nothing generated yet).
    const { data: draftRow, error: draftErr } = await sb
      .from("pages")
      .select("draft_content")
      .eq("tenant_id", t.id)
      .eq("slug", "")
      .maybeSingle();
    if (draftErr) {
      console.error("[edit/regenerate] draft read failed", host, draftErr.message);
      return {
        ok: false,
        error: "Не вдалося прочитати поточну чернетку — спробуйте ще раз за хвилину.",
      };
    }
    const draftPhotos = draftPhotoUrls(
      (draftRow?.draft_content as { blocks?: unknown } | null)?.blocks,
    );

    // Real uploaded photos survive regeneration (§4.8: never fabricate
    // imagery), and the vetting written at generation time rides along so the
    // hero fallback and gallery keep ranking by quality. The generated hero is
    // REUSED (already paid for) — the brand copy here, the draft's own copy is
    // merged by the pipeline (§8: editor's generatedHero comes from oldDraft).
    const brand = (t.brand ?? {}) as {
      logoUrl?: string;
      photos?: string[];
      photoMeta?: PhotoMeta[];
      generatedHero?: string;
    };
    const media: SiteMedia = sanitizeMedia({
      logoUrl: brand.logoUrl,
      // Draft FIRST, then whatever else the brand still knows about. The order
      // is load-bearing: sanitizeMedia truncates at MAX_PHOTOS, so the tail that
      // gets dropped must be the stale import, never the owner's own pick.
      photos: [...draftPhotos, ...(brand.photos ?? [])],
      generatedHero: brand.generatedHero,
      // Vetting rides along by URL, so a harvested photo that WAS vetted at
      // generation keeps its ranking; one the owner added later simply has none
      // and is ranked on benefit of the doubt.
      photoMeta: brand.photoMeta,
    });

    const res = await runPipeline({
      host,
      facts: (t.facts ?? {}) as BusinessFacts,
      verticalId: t.vertical,
      media,
      mode: "editor",
    });
    return res.ok
      ? { ok: true, blocks: res.blocks }
      : { ok: false, error: res.error };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * «Опублікувати»: draft → published + cache purge (§5.5/§9.1). The promotion
 * itself lives in publishDraft() — this action only adds the ownership gate and
 * the rate limit. Duplicating the promotion here once cost the live site its
 * deferred-image self-correction, so there is exactly one implementation.
 *
 * Free since 2026-08-06 — the ₴999 buys the custom domain, not the publish.
 */
export async function publishSite(
  host: string,
): Promise<{ ok: boolean; error?: string }> {
  const gate = await requireMember({ host }); // §3.1
  if (!gate.ok) return { ok: false, error: gate.error };

  // Publishing purges the tenant cache and rewrites live content — cheap for
  // the owner, not free for us. Fails open like every other limiter.
  const limit = await checkRateLimit("publish", ipFromHeaders(await headers()));
  if (!limit.ok) return { ok: false, error: rateLimitMessage(limit.retryAfterSec) };

  // Without Supabase there is nothing to publish and getServiceClient() throws —
  // an unhandled server-action error the owner can do nothing with. Answer the
  // same way the sibling actions do (§3.1 degrade-open).
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Сервіс тимчасово недоступний. Спробуйте пізніше." };
  }

  const { data: t } = await getServiceClient()
    .from("tenants")
    .select("id")
    .eq("host", host)
    .maybeSingle();
  await trackFunnel("publish_clicked", { tenantId: (t?.id as string) ?? undefined, meta: { host, source: "editor" } });

  const res = await publishDraft(host);
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}

// ── Block-level AI edit (current-cycle п.1) ──────────────────────────────────
import { aiEditBlock } from "@/lib/ai/edit-block";
import { checkRateLimit, ipFromHeaders, rateLimitMessage } from "@/lib/rate-limit";
import { headers } from "next/headers";
import { sendTelegramMessage } from "@/lib/telegram/push";
import { isAnthropicConfigured } from "@/lib/ai/anthropic";

/**
 * «Відредагувати з ШІ»: rewrites ONE block's props per the owner's instruction.
 * Result goes back to the client FORM (draft) — the human reviews and saves;
 * nothing is persisted here (§3: AI fills the form, the person confirms).
 */
export async function aiEditBlockAction(
  host: string,
  block: { type: string; props: unknown },
  instruction: string,
): Promise<{ ok: true; props: unknown; note?: string } | { ok: false; error: string }> {
  const gate = await requireMember({ host });
  if (!gate.ok) return { ok: false, error: gate.error ?? "Потрібно увійти." };
  if (!isAnthropicConfigured()) return { ok: false, error: "AI не налаштовано." };
  if (!instruction.trim()) return { ok: false, error: "Опишіть, що змінити." };

  const limit = await checkRateLimit("ai_edit", ipFromHeaders(await headers()));
  if (!limit.ok) return { ok: false, error: rateLimitMessage(limit.retryAfterSec) };

  const sb = getServiceClient();
  const { data: t } = await sb
    .from("tenants")
    .select("facts, vertical")
    .eq("host", host)
    .maybeSingle();
  if (!t) return { ok: false, error: "Сайт не знайдено." };

  return aiEditBlock({
    type: block.type,
    props: block.props,
    instruction,
    facts: (t.facts ?? {}) as Partial<BusinessFacts>,
    verticalId: t.vertical,
  });
}

// ── «Хочу кастомні зміни» (current-cycle п.5, апсел-канал) ──────────────────
export async function customRequestAction(
  host: string,
  message: string,
): Promise<{ ok: boolean; error?: string }> {
  const gate = await requireMember({ host });
  if (!gate.ok) return { ok: false, error: gate.error ?? "Потрібно увійти." };
  const text = message.trim().slice(0, 2000);
  if (!text) return { ok: false, error: "Опишіть, що ви хочете змінити." };

  const limit = await checkRateLimit("custom_request", ipFromHeaders(await headers()));
  if (!limit.ok) return { ok: false, error: rateLimitMessage(limit.retryAfterSec) };

  const sb = getServiceClient();
  const { data: t } = await sb
    .from("tenants")
    .select("id, host, brand, facts")
    .eq("host", host)
    .maybeSingle();
  if (!t) return { ok: false, error: "Сайт не знайдено." };

  const facts = (t.facts ?? {}) as { phone?: string };
  const { data: row, error } = await sb
    .from("custom_requests")
    .insert({ tenant_id: t.id, message: text, contact: facts.phone ?? null })
    .select("id")
    .single();
  if (error || !row) return { ok: false, error: "Не вдалося надіслати. Спробуйте ще раз." };

  // Best-effort push to the platform admin (env-configured chat).
  const adminChat = process.env.ADMIN_TELEGRAM_CHAT_ID;
  if (adminChat) {
    const businessName = (t.brand as { businessName?: string } | null)?.businessName ?? t.host;
    const ok = await sendTelegramMessage(
      adminChat,
      `🛠 <b>Запит на кастомні зміни</b>\n\n🏪 ${businessName} (${t.host})\n📞 ${facts.phone ?? "—"}\n\n💬 ${text}`,
    );
    if (ok) await sb.from("custom_requests").update({ pushed_at: new Date().toISOString() }).eq("id", row.id);
  }
  return { ok: true };
}
