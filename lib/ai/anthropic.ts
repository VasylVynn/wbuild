import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Lazy Anthropic client. Reads ANTHROPIC_API_KEY from the environment; only
 * throws when actually used, so the app runs without it until Phase 2 features
 * are exercised.
 *
 * Model is pinned to Opus 4.8 (the claude-api skill's mandated default). It is a
 * single constant so it can be switched to a cheaper tier (e.g. claude-sonnet-4-6)
 * for per-tenant generation at scale — an owner cost decision, not a silent one.
 */
export const GEN_MODEL = "claude-opus-4-8";

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
