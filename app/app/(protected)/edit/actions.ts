"use server";

import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { requireMember } from "@/lib/tenant/membership";
import { parseBlockProps, type StoredBlock } from "@/lib/blocks/schema";
import { blockPlacementSchema } from "@/lib/blocks/schema";
import { getBlockFields } from "@/lib/blocks/fields";
import { getVertical } from "@/lib/verticals/registry";
import { generateSite } from "@/lib/ai/generate";
import { buildDossier } from "@/lib/dossier";
import type { SiteMedia } from "@/lib/media/media";
import type { BusinessFacts } from "@/lib/verticals/schema";
import { type PageSeo } from "@/lib/tenant/types";
import type { PageContent } from "@/lib/site/page-content";
import { publishDraft } from "@/lib/site/publish";
import { trackFunnel } from "@/lib/analytics/funnel";
import { runStyleAudit } from "@/lib/design/style-audit";
import { buildSectionDigest } from "@/lib/site/inspect";
import type { StyleAuditReport } from "@/lib/site/page-content";

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
  blocks: StoredBlock[];
  telegramConnected: boolean;
  // The wireframe this draft was composed against — the preview renders through
  // its OWN section components + wrapper, matching the published site.
  templateId?: string;
  displayLogoUrl?: string;
  // The model-written stylesheet for this draft. The frame preview must read the
  // DRAFT's design, or it shows a bare grey wireframe while the site is styled.
  wireCss?: string;
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
    .select("draft_content")
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
    blocks: ((p?.draft_content as { blocks?: StoredBlock[] } | null)?.blocks ?? []) as StoredBlock[],
    telegramConnected: Boolean(t.telegram_chat_id),
    templateId: (p?.draft_content as { templateId?: string } | null)?.templateId,
    wireCss: (p?.draft_content as { wireCss?: string } | null)?.wireCss,
    displayLogoUrl: (t.brand as { logoUrl?: string } | null)?.logoUrl,
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
    const { error } = await sb
      .from("pages")
      // Spread, don't rebuild: this action owns `seo` and nothing else. Listing
      // the fields by hand is how a draft save silently dropped the site's
      // design (templateId/wireCss) and the image job's genToken.
      .update({ draft_content: { ...draft, ...(hasSeo ? { seo: next } : { seo: undefined }) } })
      .eq("id", p.id);
    if (error) return { ok: false, error: error.message };
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
    const { error } = await sb
      .from("pages")
      // `seo` (wave D1) must round-trip a block save, like pocket — dropping it
      // here would silently erase the page meta on the first manual edit.
      // Same rule as saveDraftSeo: this action owns `blocks`, so everything
      // else on the draft — design, pocket, seo, genToken — rides through.
      .update({ draft_content: { ...draft, blocks: valid } })
      .eq("id", p.id);
    if (error) return { ok: false, error: error.message };
    return { ok: true }; // draft save NEVER purges the cache (§5.5)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * «Згенерувати ще раз» (§3 п.5 / §4.7): re-run generation from the tenant's
 * FACTS into the draft — a new composition AND a new stylesheet. The previous
 * draft blocks go to the pocket (never deleted).
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

    // Real uploaded photos survive regeneration (§4.8: never fabricate imagery).
    // The generated hero is REUSED here (already paid for) — regeneration never
    // generates a new image; that only happens on the no-photos publish path.
    const brand = (t.brand ?? {}) as {
      logoUrl?: string;
      photos?: string[];
      generatedHero?: string;
      designNonce?: number;
    };

    const { data: p, error: pErr } = await sb
      .from("pages")
      .select("id, draft_content")
      .eq("tenant_id", t.id)
      .eq("slug", "")
      .maybeSingle();
    // This read feeds the stylesheet fallback below, and `draft_content` is
    // replaced wholesale. A swallowed transient failure would look like «no
    // stored sheet» and let a styling failure wipe it — surface it instead.
    if (pErr) return { ok: false, error: `page read failed: ${pErr.message}` };
    if (!p) return { ok: false, error: "page not found" };
    const oldDraft = p.draft_content as
      | {
          blocks?: StoredBlock[];
          pocket?: StoredBlock[];
          seo?: PageSeo;
          generatedHero?: string;
          wireCss?: string;
        }
      | null;

    // The dossier is the bare facts+media build — the tenant path has no
    // photoMeta/snapshot, so photo casting falls back deterministically. The
    // generated hero is REUSED (already paid for): regeneration never mints a
    // new image.
    const media: SiteMedia = {
      logoUrl: brand.logoUrl,
      photos: brand.photos ?? [],
      generatedHero: oldDraft?.generatedHero ?? brand.generatedHero,
    };
    const site = await generateSite(buildDossier({ facts: t.facts, media }), t.vertical, media);
    const oldBlocks = oldDraft?.blocks ?? [];
    const oldPocket = oldDraft?.pocket ?? [];

    // The nonce advances so the re-styling starts from a different hue
    // than the previous run — «згенерувати ще раз» must look different, not
    // just read differently.
    const designNonce = typeof brand.designNonce === "number" ? brand.designNonce + 1 : 0;
    let wireCss: string | undefined = oldDraft?.wireCss;
    // Regeneration produced a NEW composition — different sections, different
    // order — so the stylesheet must be rewritten too, or the page renders
    // half-styled.
    //
    // Fail-open means KEEPING the previous sheet, which requires seeding the
    // variable with it: `draft_content` is replaced wholesale below, so leaving
    // this undefined on a styling failure would silently delete the draft's
    // stylesheet and leave the owner a grey wireframe. An old sheet against a
    // new composition degrades gracefully — every section styles through the
    // same `wire-*` class contract — so it is a genuinely better fallback than
    // nothing.
    const brief = [
      `${t.facts.businessName}, ${t.facts.city}.`,
      t.facts.about ?? "",
      t.facts.services?.length
        ? `Послуги: ${t.facts.services.map((s: { name: string }) => s.name).slice(0, 8).join(", ")}.`
        : "",
    ]
      .filter(Boolean)
      .join(" ");
    const hue = Math.floor(mulberry32(designSeed(`${host}:hue`, designNonce))() * 360);
    try {
      wireCss = (await generateWireStyle(brief, { hue })).css;
    } catch (e) {
      console.error(
        `[regenerate] styling failed for ${host}: ${e instanceof Error ? e.message : e}`,
      );
    }

    // Style QA gate (spec 2026-07-28): the redesign action is the only editor
    // path that mints new CSS, so it gets the same audit as generation.
    let styleAudit: StyleAuditReport | undefined;
    if (wireCss) {
      // Fail-open (must-fix from review): this call sits outside the paid
      // regeneration's own try/catch, so a throw here — before the draft
      // save below — would abort the whole action and lose the regen the
      // owner just paid for. Ship the unaudited sheet instead.
      try {
        const audited = await runStyleAudit({
          css: wireCss,
          sectionDigest: buildSectionDigest(site.blocks),
          brief,
          hue,
        });
        wireCss = audited.css;
        styleAudit = audited.report;
      } catch (e) {
        console.warn(`[style-audit] redesign gate failed (fail-open): ${e instanceof Error ? e.message : e}`);
      }
    }

    // Regeneration produces fresh SEO meta with the fresh content; keep the
    // previous meta only when the model returned none.
    const seo = site.seo ?? oldDraft?.seo;
    await sb
      .from("pages")
      .update({
        draft_content: {
          blocks: site.blocks,
          pocket: [...oldPocket, ...oldBlocks].slice(-40),
          // Design rides with the blocks it was generated for; publishing is
          // the only moment the live site's look changes (invariant 6).
          templateId: site.templateId,
          ...(wireCss && { wireCss }),
          ...(styleAudit && { styleAudit }),
          // Carry the generated hero forward so the NEXT regeneration reuses it
          // (new sites no longer keep a brand copy — draft_content is the home).
          ...(media.generatedHero && { generatedHero: media.generatedHero }),
          ...(seo && { seo }),
        },
      })
      .eq("id", p.id);

    // The advanced nonce is persisted so the NEXT regeneration rolls a further
    // hue. It is a counter, not a design: nothing the live site renders reads
    // it, so writing it to the unversioned `brand` is not a publish.
    await sb
      .from("tenants")
      .update({ brand: { ...(t.brand as Record<string, unknown>), designNonce } })
      .eq("id", t.id);

    return { ok: true, blocks: site.blocks };
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
import { designSeed, mulberry32 } from "@/lib/design/seed";
import { generateWireStyle } from "@/lib/design/wire-style";

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
