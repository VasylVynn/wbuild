import type { ThemePresetId } from "@/lib/theme/presets";
import type { BusinessFactKey } from "./schema";

/** Per-field metadata for the onboarding form + prompt (labels, grounding). */
export interface FieldMeta {
  label: string; // Ukrainian label
  fact: boolean; // true = verbatim fact (grounded §4.4); false = creative
  required?: boolean; // part of the "enough info" gate
}

/**
 * A vertical = pure configuration over the shared businessFactsSchema. Adding a
 * business type is data, not code (Fable verdict). The registry maps id → config.
 */
export interface VerticalConfig {
  id: string; // enum id, e.g. "florist"
  label: string; // "Квіткарня"
  /** Lowercased keywords to classify the vertical from conversation. */
  aliases: string[];
  /** One line for the onboarding agent: who the owner is + what to collect. */
  personaHint: string;
  /** One line for the generation prompt: tone + which sections shine. */
  genHint: string;
  /**
   * The DOMAIN-ADVISOR knowledge (owner feedback): what content is valuable for
   * THIS niche + which niche-specific clarifying questions to ask. The agent
   * uses this to proactively, simply guide an owner who doesn't know what to put
   * on a site (e.g. florist → suggest delivery/wedding; lawyer → ask which legal
   * specialization first).
   */
  advisorGuidance: string;
  /** Field labels + fact/creative + required, keyed by BusinessFacts keys. */
  fields: Partial<Record<BusinessFactKey, FieldMeta>>;
  /** Plausible price range (UAH) for ONE service — validation flags outliers. */
  priceRange: { min: number; max: number };
  /** Theme presets that fit this vertical (generation picks among these). */
  themePresetIds: ThemePresetId[];
  /** Example service names to hint the agent (NOT facts — never inserted). */
  exampleServices: string[];
  /**
   * Atmospheric, NON-LITERAL hero-image prompts (§4.8 honesty invariant): used
   * only to generate a background for a site with NO owner photos. Never depicts
   * the actual venue, real products, people, or readable text — data so the owner
   * can tune wording without touching logic. A random variant is picked per site.
   */
  imagePrompts: string[];
}
