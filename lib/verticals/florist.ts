import { z } from "zod";

/**
 * Florist vertical — questionnaire schema (§4.4).
 *
 * Two categories of data live here:
 *   `fact: true`  — verbatim from the user's answers; post-validated by string
 *                   compare before the page goes live (name, phone, address,
 *                   hours, service prices, testimonial quotes and authors).
 *   `fact: false` — creative copy; the AI may write or embellish freely
 *                   (about/description text).
 *
 * `floristRequiredFields` is the "enough info to generate" gate used by the
 * agent-chat loop (brief §4.4): generation starts only after all required
 * fields are collected.
 */

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------
export const floristFactsSchema = z.object({
  /** Official business name — copied verbatim to brand, hero, JSON-LD. */
  businessName: z.string().min(1),

  /** City used for local SEO and footer. */
  city: z.string().min(1),

  /** Primary phone — copied verbatim to footer and contacts block. */
  phone: z.string().min(1),

  /** Street address — copied verbatim. */
  address: z.string().optional(),

  /** Opening hours — free-form text copied verbatim. */
  hours: z.string().optional(),

  /** Short "About us" paragraph — creative, may be AI-written. */
  about: z.string().optional(),

  /**
   * Service list.  `name` and `price` are facts (copied 1:1).
   * `description` is creative (AI may elaborate).
   */
  services: z
    .array(
      z.object({
        name: z.string().min(1),
        price: z.string().optional(),
        description: z.string().optional(),
      }),
    )
    .optional(),

  /**
   * Customer testimonials — `quote`, `author`, and `role` are all facts
   * (customer's real words, never invented).
   */
  testimonials: z
    .array(
      z.object({
        quote: z.string().min(1),
        author: z.string().min(1),
        role: z.string().optional(),
      }),
    )
    .optional(),

  /** Social media links — label + href, both verbatim. */
  socials: z
    .array(
      z.object({
        label: z.string().min(1),
        href: z.string().min(1),
      }),
    )
    .optional(),
});

export type FloristFacts = z.infer<typeof floristFactsSchema>;

// ---------------------------------------------------------------------------
// Completion gate (§4.4)
// ---------------------------------------------------------------------------

/**
 * Minimal set that must be present before the generation step may run.
 * Agent chat marks the session "ready" only after collecting all of these.
 */
export const floristRequiredFields: (keyof FloristFacts)[] = [
  "businessName",
  "city",
  "phone",
];

// ---------------------------------------------------------------------------
// Field metadata — drives the questionnaire UI and the agent prompt
// ---------------------------------------------------------------------------

/**
 * Per-field display metadata.
 *
 * `label` — Ukrainian label shown in the chat form / admin UI.
 * `fact`  — true = the value is used verbatim (no AI rewriting);
 *            false = creative field, AI may rewrite or extend.
 */
export const floristFieldMeta: Record<
  keyof FloristFacts,
  { label: string; fact: boolean }
> = {
  businessName:  { label: "Назва квіткового магазину",   fact: true  },
  city:          { label: "Місто",                        fact: true  },
  phone:         { label: "Номер телефону",               fact: true  },
  address:       { label: "Адреса магазину",              fact: true  },
  hours:         { label: "Години роботи",                fact: true  },
  about:         { label: "Про нас",                      fact: false },
  services:      { label: "Послуги та ціни",              fact: true  },
  testimonials:  { label: "Відгуки клієнтів",            fact: true  },
  socials:       { label: "Соціальні мережі",             fact: true  },
};
