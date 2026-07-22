import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Lazy Anthropic client. Reads ANTHROPIC_API_KEY from the environment; only
 * throws when actually used, so the app runs without it until Phase 2 features
 * are exercised.
 *
 * Models are single constants so the tier is an explicit owner decision. Owner
 * chose Sonnet 4.6 (2026-07-07): ~3× cheaper than Opus, strong enough for
 * structured generation and slot-filling chat. Bump to claude-opus-4-8 if
 * first-generation quality needs it.
 */
export const GEN_MODEL = "claude-sonnet-4-6"; // site generation (Phase 2)
export const CHAT_MODEL = "claude-sonnet-4-6"; // onboarding agent (Phase 3)
// Photo classification/alt/OCR is a bounded task — Haiku is 3-4x cheaper and
// ~2x faster than Sonnet with no practical quality loss here: OCR results
// always pass through a human confirmation card before becoming facts.
export const VISION_MODEL = "claude-haiku-4-5-20251001"; // photo intelligence (wave G)

let cached: Anthropic | null = null;

export function isAnthropicConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function getAnthropic(): Anthropic {
  if (cached) return cached;
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not set in .env.local");
  }
  cached = new Anthropic();
  return cached;
}
