"use server";

import { onboardTurn, type ChatMsg, type OnboardTurnResult } from "@/lib/ai/onboard";
import { uniqueSubdomain } from "@/lib/tenant/subdomain";
import { generateAndPublish } from "@/lib/site/publish";
import { ROOT_DOMAIN } from "@/lib/config";
import type { FloristFacts } from "@/lib/verticals/florist";

/** One onboarding chat turn (stateless — the client holds history + facts). */
export async function onboardAction(
  history: ChatMsg[],
  facts: Partial<FloristFacts>,
): Promise<OnboardTurnResult> {
  return onboardTurn(history, facts);
}

export type FinalizeResult = { ok: true; host: string; url: string } | { ok: false; error: string };

/** Confirmed facts → generate + publish the site → return its live URL. */
export async function finalizeAction(facts: FloristFacts): Promise<FinalizeResult> {
  try {
    const host = await uniqueSubdomain(facts.businessName);
    await generateAndPublish(facts, host, true);
    const isProd = process.env.NODE_ENV === "production";
    const port = ROOT_DOMAIN.includes(":") ? `:${ROOT_DOMAIN.split(":")[1]}` : "";
    const url = `${isProd ? "https" : "http"}://${host}${isProd ? "" : port}`;
    return { ok: true, host, url };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
