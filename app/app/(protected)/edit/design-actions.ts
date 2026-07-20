"use server";

import { getServiceClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/tenant/membership";
import { resolveTheme } from "@/lib/theme/presets";
import { designDnaSchema, carryDnaFields, dnaSeed, mulberry32 } from "@/lib/theme/dna";
import { rollBundleDna } from "@/lib/theme/dna-roll";
import { shuffleMiddles } from "@/lib/site/publish";
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
/**
 * Design re-roll (wave DNA-1): bump designNonce → draw a new DNA with the
 * full phase-1 distinctness guarantee (different palette FAMILY + different
 * font pair vs the current one) and rewrite the DRAFT theme from it. Content
 * untouched; draft-only — no cache purge (invariant №6, publish is human).
 */
export async function rerollDesignAction(
  host: string,
): Promise<{ ok: boolean; theme?: Theme; error?: string }> {
  try {
    const gate = await requireMember({ host }); // §3.1
    if (!gate.ok) return { ok: false, error: gate.error };

    const sb = getServiceClient();
    const { data: t } = await sb
      .from("tenants")
      .select("id, draft_theme, brand, vertical")
      .eq("host", host)
      .maybeSingle();
    if (!t) return { ok: false, error: "tenant not found" };

    const prevTheme = (t.draft_theme ?? {}) as Theme & { dna?: unknown };
    const prevParsed = designDnaSchema.safeParse(prevTheme.dna);
    const previous = prevParsed.success ? prevParsed.data : null;
    const brand = (t.brand ?? {}) as { photos?: string[]; templateId?: string };

    // Template sites: the template owns the look — bundles reach them in a
    // later DNA-2 subwave; re-roll stays a no-op there rather than lying.
    if (brand.templateId) return { ok: false, error: "template sites re-roll in DNA-2b" };

    const { dna } = rollBundleDna({
      tenantId: host,
      nonce: previous ? previous.designNonce + 1 : 1,
      verticalId: (t.vertical as string) ?? undefined,
      photosCount: brand.photos?.length ?? 0,
      previous,
    });
    const theme: Theme = {
      ...resolveTheme(dna.presetId),
      fontPairId: dna.fontPairId,
      dna,
    };

    // Re-skin + re-rhythm the DRAFT page from the new bundle (draft-only).
    const { data: p } = await sb
      .from("pages")
      .select("id, draft_content")
      .eq("tenant_id", t.id)
      .eq("slug", "")
      .maybeSingle();
    if (p) {
      const draft = (p.draft_content ?? {}) as {
        blocks?: StoredBlock[];
        pocket?: StoredBlock[];
        seo?: PageSeo;
      };
      const rng = mulberry32(dnaSeed(host, dna.designNonce));
      let blocks = (draft.blocks ?? []).map((b) => {
        const o = dna.skinOverrides?.[b.type];
        return o === undefined ? b : { ...b, skin: o || undefined };
      });
      blocks = shuffleMiddles(blocks, rng);
      const { error: pe } = await sb
        .from("pages")
        .update({ draft_content: { ...draft, blocks } })
        .eq("id", p.id);
      if (pe) return { ok: false, error: pe.message };
    }

    const { error } = await sb.from("tenants").update({ draft_theme: theme }).eq("id", t.id);
    if (error) return { ok: false, error: error.message };
    return { ok: true, theme };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "reroll failed" };
  }
}

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
      .select("id, brand, draft_theme")
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

    // Genome survives a pack switch (codex review): preset updates, the rest
    // of the DNA (pair/motion/nonce) carries over.
    const theme: Theme = {
      ...resolveTheme(pack.themePresetId),
      ...carryDnaFields(
        t.draft_theme as { fontPairId?: string; dna?: unknown } | null,
        pack.themePresetId,
      ),
    };
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
