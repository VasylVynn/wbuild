import { NextResponse } from "next/server";
import { isAnthropicConfigured } from "@/lib/ai/anthropic";
import { onboardTurn, type ChatMsg } from "@/lib/ai/onboard";
import type { FloristFacts } from "@/lib/verticals/florist";

/**
 * DEV-ONLY: run one onboarding turn statelessly (for testing the slot-filling
 * agent before the chat UI exists).
 *   POST /api/dev/onboard  { history: ChatMsg[], facts?: Partial<FloristFacts> }
 * Returns { message, facts, ready }.
 */
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "disabled in production" }, { status: 403 });
  }
  if (!isAnthropicConfigured()) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 400 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    history?: ChatMsg[];
    facts?: Partial<FloristFacts>;
    verticalId?: string;
  };
  try {
    const result = await onboardTurn(body.history ?? [], body.facts ?? {}, body.verticalId);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: "onboard turn failed", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
