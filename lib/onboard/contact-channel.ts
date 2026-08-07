import type { BusinessFacts } from "@/lib/verticals/schema";

/**
 * Contact channel (plan C7): the ONE readiness requisite besides the name.
 * A site without a phone is legitimate — IG-direct/Telegram + the force-
 * injected lead_form (invariant 8) carry the funnel.
 *
 * Lives OUTSIDE lib/ai/onboard.ts on purpose: that module is `server-only`
 * (it pulls the whole Anthropic/scrape graph), while the client
 * (OnboardChat) needs this predicate for its generate backstop. A value
 * import of a server-only module from a "use client" file is a hard
 * Turbopack build error. lib/ai/onboard.ts re-exports this so server code
 * keeps a single source of truth.
 */
export function hasContactChannel(facts: Partial<BusinessFacts>): boolean {
  return [facts.phone, facts.telegram, facts.instagram, facts.viber].some(
    (v) => typeof v === "string" && v.trim().length > 0,
  );
}
