"use server";

import { getServiceClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/tenant/membership";
import { revalidateTenant } from "@/lib/cache";
import { parseBlockProps, type StoredBlock } from "@/lib/blocks/schema";
import { blockPlacementSchema } from "@/lib/blocks/schema";
import { getBlockFields } from "@/lib/blocks/fields";
import { themePresets, resolveTheme, type ThemePresetId } from "@/lib/theme/presets";
import { getVertical } from "@/lib/verticals/registry";
import { generateSite } from "@/lib/ai/generate";
import type { Theme } from "@/lib/theme/tokens";
import type { BusinessFacts } from "@/lib/verticals/schema";
import { displayLogoUrl, type PageSeo } from "@/lib/tenant/types";
import { adaptLogoForTemplate } from "@/lib/media/logo-adapt";

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
  theme: Theme;
  themeOptions: { id: string; label: string }[];
  blocks: StoredBlock[];
  telegramConnected: boolean;
  // Active design pack id (undefined for sites generated before packs shipped) —
  // the editor's pack picker reads this to show the current selection.
  packId?: string;
  // Active site-template id (template sites): the preview renders through the
  // template's OWN section components + wrapper, matching the published site.
  templateId?: string;
  // Logo the site currently displays (original vs adapted already resolved) —
  // the frame preview must match the published render (H1).
  displayLogoUrl?: string;
  // Draft page SEO meta (wave D) — shown to the editor agent; goes live on publish.
  seo?: PageSeo;
}

export async function getEditorData(host: string): Promise<EditorData | null> {
  // Ownership gate (§3.1): a non-member gets null → the page 404s.
  if (!(await requireMember({ host })).ok) return null;
  const sb = getServiceClient();
  const { data: t } = await sb
    .from("tenants")
    .select("id, host, brand, vertical, status, draft_theme, telegram_chat_id")
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
    theme: (t.draft_theme as Theme) ?? resolveTheme(vertical.themePresetIds[0]),
    themeOptions: vertical.themePresetIds.map((id) => ({ id, label: themePresets[id].label })),
    blocks: ((p?.draft_content as { blocks?: StoredBlock[] } | null)?.blocks ?? []) as StoredBlock[],
    telegramConnected: Boolean(t.telegram_chat_id),
    packId: (t.brand as { packId?: string } | null)?.packId,
    templateId: (t.brand as { templateId?: string } | null)?.templateId,
    displayLogoUrl: displayLogoUrl(
      (t.brand ?? {}) as Parameters<typeof displayLogoUrl>[0],
    ),
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

    const draft = (p.draft_content ?? {}) as {
      blocks?: StoredBlock[];
      pocket?: StoredBlock[];
      seo?: PageSeo;
    };
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
      .update({
        draft_content: {
          blocks: draft.blocks ?? [],
          pocket: draft.pocket ?? [],
          ...(hasSeo && { seo: next }),
        },
      })
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
      // Preserve the design placement fields across a draft save: `skin` (pack
      // sites) and `section` (template sites) must round-trip or the site loses
      // its look on the first edit.
      skin: b.skin,
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
    const draft = p.draft_content as { pocket?: StoredBlock[]; seo?: PageSeo } | null;
    const pocket = draft?.pocket ?? [];
    const { error } = await sb
      .from("pages")
      // `seo` (wave D1) must round-trip a block save, like pocket — dropping it
      // here would silently erase the page meta on the first manual edit.
      .update({ draft_content: { blocks: valid, pocket, ...(draft?.seo && { seo: draft.seo }) } })
      .eq("id", p.id);
    if (error) return { ok: false, error: error.message };
    return { ok: true }; // draft save NEVER purges the cache (§5.5)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function switchTheme(
  host: string,
  presetId: string,
): Promise<{ ok: boolean; theme?: Theme; error?: string }> {
  const gate = await requireMember({ host }); // §3.1
  if (!gate.ok) return { ok: false, error: gate.error };
  if (!(presetId in themePresets)) return { ok: false, error: "unknown preset" };
  const theme = resolveTheme(presetId as ThemePresetId);
  const sb = getServiceClient();
  const { error } = await sb.from("tenants").update({ draft_theme: theme }).eq("host", host);
  if (error) return { ok: false, error: error.message };
  return { ok: true, theme };
}

/**
 * The switchTemplate pressure valve (§3 п.5 / §4.7, adapted to free
 * composition): re-run generation from the tenant's FACTS into the draft; the
 * previous draft blocks go to the pocket (never deleted).
 */
export async function regenerateSite(
  host: string,
): Promise<{ ok: boolean; blocks?: StoredBlock[]; theme?: Theme; error?: string }> {
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
      packId?: string;
      templateId?: string;
    };
    // Reuse the site's saved template/pack so regeneration KEEPS the look — only
    // the content/composition is re-rolled, not the design. templateId wins when
    // present (template path ignores packs).
    const site = await generateSite(
      t.facts as BusinessFacts,
      t.vertical,
      {
        logoUrl: brand.logoUrl,
        photos: brand.photos ?? [],
        generatedHero: brand.generatedHero,
      },
      brand.packId,
      brand.templateId,
    );

    const { data: p } = await sb
      .from("pages")
      .select("id, draft_content")
      .eq("tenant_id", t.id)
      .eq("slug", "")
      .maybeSingle();
    if (!p) return { ok: false, error: "page not found" };
    const oldDraft = p.draft_content as
      | { blocks?: StoredBlock[]; pocket?: StoredBlock[]; seo?: PageSeo }
      | null;
    const oldBlocks = oldDraft?.blocks ?? [];
    const oldPocket = oldDraft?.pocket ?? [];

    // Regeneration produces fresh SEO meta with the fresh content; keep the
    // previous meta only when the model returned none.
    const seo = site.seo ?? oldDraft?.seo;
    await sb
      .from("pages")
      .update({
        draft_content: {
          blocks: site.blocks,
          pocket: [...oldPocket, ...oldBlocks].slice(-40),
          ...(seo && { seo }),
        },
      })
      .eq("id", p.id);
    // Pin the design source the first time (older sites have neither id yet) so
    // future regenerations keep this look; merge into brand without clobbering it.
    const tenantUpdate: { draft_theme: Theme; brand?: Record<string, unknown> } = {
      draft_theme: site.theme,
    };
    const brandPatch: Record<string, unknown> = {};
    if (!brand.packId && site.packId) brandPatch.packId = site.packId;
    if (!brand.templateId && site.templateId) brandPatch.templateId = site.templateId;
    // H1: a site landing on a template for the FIRST time with an existing
    // logo gets its adapted variant now (fail-open — null keeps the original).
    if (brandPatch.templateId && brand.logoUrl) {
      const adapted = await adaptLogoForTemplate({
        logoUrl: brand.logoUrl,
        templateId: brandPatch.templateId as string,
      });
      if (adapted) brandPatch.logoAdaptedUrl = adapted;
    }
    if (Object.keys(brandPatch).length > 0) {
      tenantUpdate.brand = { ...(t.brand as Record<string, unknown>), ...brandPatch };
    }
    await sb.from("tenants").update(tenantUpdate).eq("id", t.id);
    // Draft-only saves must NOT purge — but brand is UNVERSIONED, so when the
    // patch touched it (first-time template/pack pin, adapted logo) the LIVE
    // site reads new values and the cache must go.
    if (tenantUpdate.brand) await revalidateTenant(host);

    return { ok: true, blocks: site.blocks, theme: site.theme };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** «Опублікувати»: draft → published atomically-ish + cache purge (§5.5/§9.1). */
export async function publishSite(host: string): Promise<{ ok: boolean; error?: string }> {
  const gate = await requireMember({ host }); // §3.1
  if (!gate.ok) return { ok: false, error: gate.error };
  const sb = getServiceClient();
  const { data: t } = await sb
    .from("tenants")
    .select("id, draft_theme")
    .eq("host", host)
    .maybeSingle();
  if (!t) return { ok: false, error: "tenant not found" };
  const { data: p } = await sb
    .from("pages")
    .select("id, draft_content")
    .eq("tenant_id", t.id)
    .eq("slug", "")
    .maybeSingle();
  if (!p) return { ok: false, error: "page not found" };

  const draft = p.draft_content as { blocks?: StoredBlock[]; seo?: PageSeo } | null;
  const blocks = draft?.blocks ?? [];
  const { error: pe } = await sb
    .from("pages")
    // Publish promotes the WHOLE page meta, not just blocks: draft seo (D1)
    // goes live here and only here (invariant 6 — AI writes draft only).
    .update({
      published_content: { blocks, ...(draft?.seo && { seo: draft.seo }) },
      is_published: true,
    })
    .eq("id", p.id);
  if (pe) return { ok: false, error: pe.message };
  const { error: te } = await sb
    .from("tenants")
    .update({ published_theme: t.draft_theme, status: "published" })
    .eq("id", t.id);
  if (te) return { ok: false, error: te.message };

  await revalidateTenant(host);
  return { ok: true };
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
