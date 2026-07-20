import { NextResponse } from "next/server";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { designDnaSchema, type DesignDNA } from "@/lib/theme/dna";
import { rollDna } from "@/lib/theme/dna-roll";
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
    .select("id, draft_theme")
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
  }> = [];
  const violations: string[] = [];

  for (let i = 0; i < steps; i++) {
    const dna = rollDna({ tenantId: host, nonce: startNonce + i, previous });
    const family = presetFamily(dna.presetId);
    if (previous) {
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
    });

    if (body.apply) {
      const theme: Theme = { ...resolveTheme(dna.presetId), fontPairId: dna.fontPairId, dna };
      const { error } = await sb
        .from("tenants")
        .update({ draft_theme: theme, published_theme: theme })
        .eq("id", t.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    previous = dna;
  }

  return NextResponse.json({ ok: violations.length === 0, rolls, violations });
}
