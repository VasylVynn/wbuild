import { z } from "zod";

/**
 * Generic business facts — the vertical-agnostic core (Fable verdict: the
 * florist schema was ~90% generic; a "vertical" is DATA, not a code fork). All
 * verticals share this shape; per-vertical differences (labels, plausible price
 * ranges, prompt hints) live in the vertical registry.
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
  // V2 relax (spec §11-V2, W0 plan C7): city and phone are OPTIONAL facts. The
  // only hard requisite for generation is businessName + ANY contact channel
  // (phone / telegram / instagram / viber — lib/onboard/contact-channel.ts);
  // a phone-less site with IG-direct as the contact is legitimate (the
  // lead_form is force-injected regardless, invariant 8). Absent = omitted
  // everywhere downstream, never bridged as "" and never invented (invariant 5).
  city: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  hours: z.string().optional(),
  viber: z.string().optional(), // freeform phone number, any formatting
  telegram: z.string().optional(), // username (with/without "@") or phone number
  // Instagram handle: bare, with "@", or a full profile URL — normalized at
  // render/import time (contact-links.ts). Feeds JSON-LD sameAs (D2), the
  // contacts block link (E7) and the Apify import (E5).
  instagram: z.string().optional(),
  // The business's ESSENCE in the owner's words — what makes them special,
  // the atmosphere, who their clients are. The no-IG interview accumulates
  // its answers here; the dossier feeds it to S1 positioning, S2б copy and
  // the image subjects. Free text, model-appended (last-wins overwrite).
  about: z
    .string()
    .describe(
      "Суть бізнесу словами власника: чим особливі, атмосфера, хто клієнти. НАКОПИЧУЙ: до вже збереженого додавай нове одним текстом, не перезаписуй і не перефразовуй сказане власником.",
    )
    .optional(),
  services: z.array(serviceFactSchema).optional(),
  testimonials: z.array(testimonialFactSchema).optional(),
  socials: z.array(socialFactSchema).optional(),
  // Onboarding-flow flags (plan A5), not business facts: the agent asks «Чи
  // маєте логотип?» / «Чи є фото?» and stores the answers here so the media
  // step and prompts adapt. Stripped in finalizeAction before generation.
  hasLogo: z.boolean().optional(),
  hasPhotos: z.boolean().optional(),
});

export type BusinessFacts = z.infer<typeof businessFactsSchema>;

/** Keys that may carry a fact for validation/labels. */
export type BusinessFactKey = keyof BusinessFacts;
