import { NextResponse } from "next/server";
import { isLlmConfigured } from "@/lib/ai/llm";
import { aiEditBlock } from "@/lib/ai/edit-block";
import type { BusinessFacts } from "@/lib/verticals/schema";

/**
 * DEV-ONLY: exercise the block AI-edit engine without the editor UI.
 *   POST /api/dev/edit-block { type, props, instruction, facts?, verticalId? }
 */
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "disabled in production" }, { status: 403 });
  }
  if (!isLlmConfigured()) {
    return NextResponse.json({ error: "OPENAI_API_KEY not set" }, { status: 400 });
  }
  const body = (await req.json().catch(() => null)) as {
    type?: string;
    props?: unknown;
    instruction?: string;
    facts?: Partial<BusinessFacts>;
    verticalId?: string;
  } | null;
  if (!body?.type || body.props === undefined || !body.instruction) {
    return NextResponse.json({ error: "type, props, instruction required" }, { status: 400 });
  }
  const result = await aiEditBlock({
    type: body.type,
    props: body.props,
    instruction: body.instruction,
    facts: body.facts ?? {},
    verticalId: body.verticalId,
  });
  return NextResponse.json(result);
}
