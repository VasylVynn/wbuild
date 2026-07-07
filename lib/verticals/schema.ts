import { z } from "zod";

/**
 * Generic business facts — the vertical-agnostic core (Fable verdict: the
 * florist schema was ~90% generic; a "vertical" is DATA, not a code fork). All
 * verticals share this shape; per-vertical differences (labels, plausible price
 * ranges, prompt hints, theme presets) live in the vertical registry.
 * Grounding (§4.4) is unchanged: these are the facts, copied verbatim.
 */

export const serviceFactSchema = z.object({
  name: z.string(),
  price: z.string().optional(), // free-form ("від 500 грн") — a fact
  description: z.string().optional(),
});

export const testimonialFactSchema = z.object({
  quote: z.string(),
  author: z.string(),
  role: z.string().optional(),
});

export const socialFactSchema = z.object({
  label: z.string(),
  href: z.string(),
});

export const businessFactsSchema = z.object({
  businessName: z.string(),
  city: z.string(),
  phone: z.string(),
  address: z.string().optional(),
  hours: z.string().optional(),
  about: z.string().optional(),
  services: z.array(serviceFactSchema).optional(),
  testimonials: z.array(testimonialFactSchema).optional(),
  socials: z.array(socialFactSchema).optional(),
});

export type BusinessFacts = z.infer<typeof businessFactsSchema>;

/** Keys that may carry a fact for validation/labels. */
export type BusinessFactKey = keyof BusinessFacts;
