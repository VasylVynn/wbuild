"use server";

import { getServiceClient } from "@/lib/supabase/server";
import { revalidateTenant } from "@/lib/cache";
import { parseBlockProps, type StoredBlock } from "@/lib/blocks/schema";
import { blockPlacementSchema } from "@/lib/blocks/schema";
import { themePresets, resolveTheme, type ThemePresetId } from "@/lib/theme/presets";
import { getVertical } from "@/lib/verticals/registry";
import { generateSite } from "@/lib/ai/generate";
import type { Theme } from "@/lib/theme/tokens";
import type { BusinessFacts } from "@/lib/verticals/schema";

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
}

export async function getEditorData(host: string): Promise<EditorData | null> {
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
  };
}

/** Validate each block against the registry; throw on structural garbage. */
function validateBlocks(blocks: StoredBlock[]): StoredBlock[] {
  return blocks.map((b) => {
    const parsed = parseBlockProps(b.type, b.props);
    if (!parsed.ok) {
      throw new Error(`Invalid block "${b.type}": ${"message" in parsed.error ? parsed.error.message : "schema mismatch"}`);
    }
    const placement = blockPlacementSchema.parse({
      anchor: b.anchor,
      navLabel: b.navLabel,
      showInNav: b.showInNav ?? false,
      hidden: b.hidden ?? false,
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
    const pocket = (p.draft_content as { pocket?: StoredBlock[] } | null)?.pocket ?? [];
    const { error } = await sb
      .from("pages")
      .update({ draft_content: { blocks: valid, pocket } })
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
    const sb = getServiceClient();
    const { data: t } = await sb
      .from("tenants")
      .select("id, facts, vertical")
      .eq("host", host)
      .maybeSingle();
    if (!t) return { ok: false, error: "tenant not found" };

    const site = await generateSite(t.facts as BusinessFacts, t.vertical);

    const { data: p } = await sb
      .from("pages")
      .select("id, draft_content")
      .eq("tenant_id", t.id)
      .eq("slug", "")
      .maybeSingle();
    if (!p) return { ok: false, error: "page not found" };
    const oldBlocks = (p.draft_content as { blocks?: StoredBlock[] } | null)?.blocks ?? [];
    const oldPocket = (p.draft_content as { pocket?: StoredBlock[] } | null)?.pocket ?? [];

    await sb
      .from("pages")
      .update({ draft_content: { blocks: site.blocks, pocket: [...oldPocket, ...oldBlocks].slice(-40) } })
      .eq("id", p.id);
    await sb.from("tenants").update({ draft_theme: site.theme }).eq("id", t.id);

    return { ok: true, blocks: site.blocks, theme: site.theme };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** «Опублікувати»: draft → published atomically-ish + cache purge (§5.5/§9.1). */
export async function publishSite(host: string): Promise<{ ok: boolean; error?: string }> {
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

  const blocks = (p.draft_content as { blocks?: StoredBlock[] } | null)?.blocks ?? [];
  const { error: pe } = await sb
    .from("pages")
    .update({ published_content: { blocks }, is_published: true })
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
