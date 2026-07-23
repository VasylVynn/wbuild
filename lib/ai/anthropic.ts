import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Lazy Anthropic client. Reads ANTHROPIC_API_KEY from the environment; only
 * throws when actually used, so the app runs without it until Phase 2 features
 * are exercised.
 *
 * Models are single constants so the tier is an explicit owner decision. Owner
 * chose Sonnet 5 for EVERY call (2026-07-22, refactor 03 §0.1): chat, generation,
 * consistency post-pass and photo intelligence all run on one tier for uniform
 * quality. Sonnet 5 vision is ~3× Haiku per call but still cents per onboarding,
 * and the better OCR/extractedInfo directly feeds the dossier (03 §1.4). Bump the
 * generation call to claude-opus-4-8 (xhigh) only if first-generation quality
 * plateaus. API-surface constraints of this tier (adaptive thinking, no
 * budget_tokens, no non-default sampling, nested output_config.effort) are
 * handled at each call site.
 */
export const GEN_MODEL = "claude-sonnet-5"; // site generation (Phase 2)
export const CHAT_MODEL = "claude-sonnet-5"; // onboarding + editor agent (Phase 3)
export const VISION_MODEL = "claude-sonnet-5"; // photo intelligence (wave G / refactor §1.4)

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
