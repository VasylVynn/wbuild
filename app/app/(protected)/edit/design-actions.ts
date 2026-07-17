"use server";

import { getServiceClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/tenant/membership";
import { resolveTheme } from "@/lib/theme/presets";
import { getPack } from "@/lib/design/packs";
import type { StoredBlock } from "@/lib/blocks/schema";
import type { Theme } from "@/lib/theme/tokens";
import type { PageSeo } from "@/lib/tenant/types";

/**
 * Design-pack switcher (§4.5 + §4.7): one draft write flips the WHOLE look —
 * the theme tokens AND every block's presentation skin — while leaving content
 * (props) and structure (order/hidden/anchors/pocket) untouched. This is the
 * editor's primary «Оформлення» control; the palette-only switchTheme stays as
 * a secondary recolor. Draft-only: NO cache purge here — «Опублікувати» does
 * that (see saveDraftBlocks §5.5).
 */
export async function switchDesignPack(
  host: string,
  packId: string,
): Promise<{ ok: boolean; theme?: Theme; blocks?: StoredBlock[]; error?: string }> {
  try {
    const gate = await requireMember({ host }); // §3.1
    if (!gate.ok) return { ok: false, error: gate.error };

    const pack = getPack(packId);
    if (!pack) return { ok: false, error: "unknown design pack" };

    const sb = getServiceClient();
    const { data: t } = await sb
      .from("tenants")
      .select("id, brand")
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

    const draft = (p.draft_content ?? {}) as {
      blocks?: StoredBlock[];
      pocket?: StoredBlock[];
      seo?: PageSeo;
    };
    const oldBlocks = draft.blocks ?? [];
    const pocket = draft.pocket ?? [];

    // Apply the pack's per-type skin to every block; a type the pack doesn't
    // cover reverts to its DEFAULT skin (the key is deleted, never left stale).
    // Only `skin` changes — props, order, anchors and every other field survive.
    const blocks: StoredBlock[] = oldBlocks.map((block) => {
      const next = { ...block } as StoredBlock & { skin?: string };
      const skin = pack.skins[block.type];
      if (skin) next.skin = skin;
      else delete next.skin;
      return next as StoredBlock;
    });

    const { error: pe } = await sb
      .from("pages")
      .update({ draft_content: { blocks, pocket, ...(draft.seo && { seo: draft.seo }) } })
      .eq("id", p.id);
    if (pe) return { ok: false, error: pe.message };

    const theme = resolveTheme(pack.themePresetId);
    // Read-modify-write brand so logo/photos/name survive; stamp the pack id so
    // the editor can highlight the active pack on reload.
    const brand = { ...((t.brand ?? {}) as Record<string, unknown>), packId };
    const { error: te } = await sb
      .from("tenants")
      .update({ draft_theme: theme, brand })
      .eq("id", t.id);
    if (te) return { ok: false, error: te.message };

    return { ok: true, theme, blocks };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
