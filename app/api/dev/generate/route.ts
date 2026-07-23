import { NextResponse } from "next/server";
import { isAnthropicConfigured } from "@/lib/ai/anthropic";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { generateDraft, publishDraft } from "@/lib/site/publish";
import { seedTenants } from "@/lib/tenant/seed";
import { sanitizeMedia } from "@/lib/media/media";
import type { BusinessFacts } from "@/lib/verticals/schema";

/**
 * DEV-ONLY: run the Phase 2 generation pipeline end to end.
 *   POST /api/dev/generate  { facts?, host?, publish? }
 * Generates a site from facts into the DRAFT (defaults to the seed florist's
 * facts) via generateDraft(); with publish=true (default) promotes it live via
 * publishDraft(). Returns a summary.
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
    facts?: BusinessFacts;
    host?: string;
    publish?: boolean;
    verticalId?: string;
    templateId?: string;
    // Wave G smokes: owner media incl. photoMeta (validated like the real path).
    media?: unknown;
  };
  const facts = body.facts ?? (seedTenants[0].facts as unknown as BusinessFacts);
  const host = body.host ?? "test.lvh.me";
  const publish = body.publish ?? true;

  const draft = await generateDraft({
    facts,
    host,
    verticalId: body.verticalId ?? "florist",
    media: body.media !== undefined ? sanitizeMedia(body.media) : undefined,
    templateId: body.templateId,
  });
  if (!draft.ok) {
    return NextResponse.json({ error: "generation failed", detail: draft.error }, { status: 500 });
  }
  if (publish) {
    const pub = await publishDraft(host);
    if (!pub.ok) {
      return NextResponse.json({ error: "publish failed", detail: pub.error }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true, url: `http://${host}:3000`, host, published: publish });
}
