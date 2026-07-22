import { NextResponse } from "next/server";
import { isAnthropicConfigured } from "@/lib/ai/anthropic";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { generateAndPublish } from "@/lib/site/publish";
import { seedTenants } from "@/lib/tenant/seed";
import { sanitizeMedia } from "@/lib/media/media";
import type { FloristFacts } from "@/lib/verticals/florist";

/**
 * DEV-ONLY: run the Phase 2 generation pipeline end to end.
 *   POST /api/dev/generate  { facts?, host?, publish? }
 * Generates a florist site from facts (defaults to the seed florist's facts),
 * writes it as a tenant + home page in Supabase, returns a summary.
 */
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "disabled in production" }, { status: 403 });
  }
  if (!isAnthropicConfigured()) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 400 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    facts?: FloristFacts;
    host?: string;
    publish?: boolean;
    verticalId?: string;
    templateId?: string;
    // Wave G smokes: owner media incl. photoMeta (validated like the real path).
    media?: unknown;
  };
  const facts = (body.facts ?? (seedTenants[0].facts as unknown as FloristFacts)) as FloristFacts;
  const host = body.host ?? "test.lvh.me";
  const publish = body.publish ?? true;

  try {
    const r = await generateAndPublish(
      facts,
      host,
      body.verticalId ?? "florist",
      publish,
      body.media !== undefined ? sanitizeMedia(body.media) : undefined,
      body.templateId,
    );
    return NextResponse.json({
      ok: true,
      url: `http://${host}:3000`,
      host: r.host,
      themePresetId: r.themePresetId,
      blockCount: r.composition.length,
      composition: r.composition,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "generation failed", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
