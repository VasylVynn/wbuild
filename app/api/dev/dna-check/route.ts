import { NextResponse } from "next/server";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { revalidateTenant } from "@/lib/cache";
import { designDnaSchema, type DesignDNA } from "@/lib/theme/dna";
import { rollBundleDna } from "@/lib/theme/dna-roll";
import { resolveTheme, presetFamily } from "@/lib/theme/presets";
import type { Theme } from "@/lib/theme/tokens";

/**
 * DEV-ONLY: the phase-1 distinctness gate (design-DNA wave 1, plan DNA1.7).
 *   POST /api/dev/dna-check { host, steps?, apply? }
 * Rolls `steps` successive DNAs for the host (each chained as `previous`) and
 * verdicts the guarantee: every consecutive roll differs in BOTH palette
 * family and font pair. With apply=true (LOCKED to *.lvh.me test tenants —
 * the dev DB is the shared Supabase project) each roll is written to the
 * tenant's draft AND published theme so a screenshot grid can be captured
 * between steps:1 calls. The published write is a deliberate DEV-ONLY breach
 * of the human-only-publish invariant, confined to the test namespace; no
 * cache revalidation (local dev only).
 */
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "disabled in production" }, { status: 403 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "supabase not configured" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    host?: string;
    steps?: number;
    apply?: boolean;
  };
  const host = body.host ?? "";
  const steps = Math.min(Math.max(body.steps ?? 6, 1), 12);
  if (!host) return NextResponse.json({ error: "host required" }, { status: 400 });
  // The dev DB is the SHARED Supabase project — NODE_ENV is not an authz
  // boundary (codex review). Mutation is limited to the local test namespace;
  // pure (apply-less) rolls stay read-only and are fine for any host.
  if (body.apply && !host.endsWith(".lvh.me")) {
    return NextResponse.json({ error: "apply allowed only for *.lvh.me test tenants" }, { status: 403 });
  }

  const sb = getServiceClient();
  const { data: t } = await sb
    .from("tenants")
    .select("id, draft_theme, vertical, brand")
    .eq("host", host)
    .maybeSingle();
  if (!t) return NextResponse.json({ error: "tenant not found" }, { status: 404 });

  const prevParsed = designDnaSchema.safeParse((t.draft_theme as { dna?: unknown } | null)?.dna);
  let previous: DesignDNA | null = prevParsed.success ? prevParsed.data : null;
  const startNonce = previous ? previous.designNonce + 1 : 0;

  const rolls: Array<{
    nonce: number;
    presetId: string;
    family: string | undefined;
    fontPairId: string;
    motionId: string;
    bundleId?: string;
    hero?: string;
  }> = [];
  const violations: string[] = [];

  const brand = (t.brand ?? {}) as { photos?: string[] };
  for (let i = 0; i < steps; i++) {
    // v2 (DNA-2): the bundle IS the distinctness unit — same bundle in a row
    // is a violation on top of the family/pair axes.
    const { dna } = rollBundleDna({
      tenantId: host,
      nonce: startNonce + i,
      verticalId: (t.vertical as string) ?? undefined,
      photosCount: brand.photos?.length ?? 0,
      previous,
    });
    const family = presetFamily(dna.presetId);
    if (previous) {
      if (previous.bundleId && previous.bundleId === dna.bundleId) {
        violations.push(`nonce ${dna.designNonce}: same bundle (${dna.bundleId})`);
      }
      if (presetFamily(previous.presetId) === family) {
        violations.push(`nonce ${dna.designNonce}: same palette family (${family})`);
      }
      if (previous.fontPairId === dna.fontPairId) {
        violations.push(`nonce ${dna.designNonce}: same font pair (${dna.fontPairId})`);
      }
    }
    rolls.push({
      nonce: dna.designNonce,
      presetId: dna.presetId,
      family,
      fontPairId: dna.fontPairId,
      motionId: dna.motionId,
      bundleId: dna.bundleId,
      hero: dna.skinOverrides?.hero,
    });

    if (body.apply) {
      const theme: Theme = { ...resolveTheme(dna.presetId), fontPairId: dna.fontPairId, dna };
      const { error } = await sb
        .from("tenants")
        .update({ draft_theme: theme, published_theme: theme })
        .eq("id", t.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      // v2: the bundle re-skins the page too (both content states — dev-only,
      // *.lvh.me test tenants; the real path does this draft-only).
      const { data: pg } = await sb
        .from("pages").select("id, draft_content, published_content")
        .eq("tenant_id", t.id).eq("slug", "").maybeSingle();
      if (pg && dna.skinOverrides) {
        const reskin = (c: unknown) => {
          const content = (c ?? {}) as { blocks?: Array<{ type: string; skin?: string }> };
          if (!content.blocks) return content;
          return {
            ...content,
            blocks: content.blocks.map((b) => {
              const o = dna.skinOverrides?.[b.type];
              return o === undefined ? b : { ...b, skin: o || undefined };
            }),
          };
        };
        await sb.from("pages").update({
          draft_content: reskin(pg.draft_content),
          published_content: reskin(pg.published_content),
        }).eq("id", pg.id);
      }
      // Direct DB write bypasses every action-level purge — without this the
      // public page keeps serving the cached previous look (found live: three
      // "different" grid states rendered one stale page).
      revalidateTenant(host);
    }
    previous = dna;
  }

  return NextResponse.json({ ok: violations.length === 0, rolls, violations });
}
