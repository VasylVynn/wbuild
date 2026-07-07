import { z } from "zod";

/**
 * Block registry contract — the single source of truth (brief §4.1).
 *
 * The SAME schemas drive: server render, generation validation, the editing
 * form (Puck-style: fields → UI), the AI tool description, and nav anchors.
 * Nothing may drift from this file.
 *
 * MVP vertical: florist. Preset `florist` = [hero, services, gallery,
 * testimonials, contacts]. `lead_form` is intentionally OUT of MVP (§15) —
 * contacts is TEXTUAL only (phone/address/hours as text, no form/buttons).
 */

// A URL to an uploaded asset (R2 / Storage) or a curated placeholder.
// Kept as a plain string for MVP — full URL validation is a later concern.
const assetUrl = z.string();

// ---------------------------------------------------------------------------
// hero
// ---------------------------------------------------------------------------
export const heroSchema = z.object({
  eyebrow: z.string().optional(),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  imageUrl: assetUrl.optional(),
  ctaLabel: z.string().optional(),
  ctaHref: z.string().optional(), // usually an in-page anchor like "#contacts"
});

// ---------------------------------------------------------------------------
// services
// ---------------------------------------------------------------------------
export const serviceItemSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.string().optional(), // free-form ("від 500 грн") — a fact, copied 1:1
  imageUrl: assetUrl.optional(),
});
export const servicesSchema = z.object({
  title: z.string().optional(),
  items: z.array(serviceItemSchema).min(1),
});

// ---------------------------------------------------------------------------
// gallery
// ---------------------------------------------------------------------------
export const galleryImageSchema = z.object({
  url: assetUrl,
  alt: z.string().optional(),
});
export const gallerySchema = z.object({
  title: z.string().optional(),
  images: z.array(galleryImageSchema).min(1),
});

// ---------------------------------------------------------------------------
// testimonials
// ---------------------------------------------------------------------------
export const testimonialItemSchema = z.object({
  quote: z.string().min(1), // customer's real words — a fact, never invented
  author: z.string().min(1),
  role: z.string().optional(),
});
export const testimonialsSchema = z.object({
  title: z.string().optional(),
  items: z.array(testimonialItemSchema).min(1),
});

// ---------------------------------------------------------------------------
// contacts (textual — MVP; no form/buttons, see §15)
// ---------------------------------------------------------------------------
export const contactsSchema = z.object({
  title: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  hours: z.string().optional(),
  email: z.string().optional(),
});

// ---------------------------------------------------------------------------
// richText — heading + body copy ("about", intro, philosophy)
// ---------------------------------------------------------------------------
export const richTextSchema = z.object({
  title: z.string().optional(),
  body: z.string().min(1),
  align: z.enum(["left", "center"]).optional(),
});

// ---------------------------------------------------------------------------
// switchback — alternating image/text rows (zig-zag) for storytelling
// ---------------------------------------------------------------------------
export const switchbackItemSchema = z.object({
  heading: z.string().min(1),
  body: z.string().min(1),
  imageUrl: assetUrl,
});
export const switchbackSchema = z.object({
  title: z.string().optional(),
  items: z.array(switchbackItemSchema).min(1),
});

// ---------------------------------------------------------------------------
// stats — short number/label accents (ONLY when grounded; never invent numbers)
// ---------------------------------------------------------------------------
export const statItemSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
});
export const statsSchema = z.object({
  title: z.string().optional(),
  items: z.array(statItemSchema).min(1),
});

// ---------------------------------------------------------------------------
// cta — a call-to-action band (usually links to #contacts)
// ---------------------------------------------------------------------------
export const ctaSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().optional(),
  buttonLabel: z.string().min(1),
  buttonHref: z.string().optional(),
});

// ---------------------------------------------------------------------------
// faq — question / answer list
// ---------------------------------------------------------------------------
export const faqItemSchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
});
export const faqSchema = z.object({
  title: z.string().optional(),
  items: z.array(faqItemSchema).min(1),
});

// ---------------------------------------------------------------------------
// Registry of prop schemas, keyed by block type.
// ---------------------------------------------------------------------------
export const blockSchemas = {
  hero: heroSchema,
  richText: richTextSchema,
  switchback: switchbackSchema,
  services: servicesSchema,
  gallery: gallerySchema,
  stats: statsSchema,
  testimonials: testimonialsSchema,
  faq: faqSchema,
  cta: ctaSchema,
  contacts: contactsSchema,
} as const;

export type BlockType = keyof typeof blockSchemas;
export const BLOCK_TYPES = Object.keys(blockSchemas) as BlockType[];

export function isBlockType(value: string): value is BlockType {
  return value in blockSchemas;
}

/** Prop type for each block, derived from its schema. */
export type BlockProps = {
  [K in BlockType]: z.infer<(typeof blockSchemas)[K]>;
};

// ---------------------------------------------------------------------------
// Block instance (what the AI generates: type + validated props).
// A discriminated union so generation output is strictly validated (§4.3).
// ---------------------------------------------------------------------------
export const blockInstanceSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("hero"), props: heroSchema }),
  z.object({ type: z.literal("richText"), props: richTextSchema }),
  z.object({ type: z.literal("switchback"), props: switchbackSchema }),
  z.object({ type: z.literal("services"), props: servicesSchema }),
  z.object({ type: z.literal("gallery"), props: gallerySchema }),
  z.object({ type: z.literal("stats"), props: statsSchema }),
  z.object({ type: z.literal("testimonials"), props: testimonialsSchema }),
  z.object({ type: z.literal("faq"), props: faqSchema }),
  z.object({ type: z.literal("cta"), props: ctaSchema }),
  z.object({ type: z.literal("contacts"), props: contactsSchema }),
]);
export type BlockInstance = z.infer<typeof blockInstanceSchema>;

/** Strict page content — used at GENERATION time to reject invalid AI output. */
export const pageContentSchema = z.object({
  blocks: z.array(blockInstanceSchema).min(1),
});
export type PageContent = z.infer<typeof pageContentSchema>;

// ---------------------------------------------------------------------------
// Placement — site structure, edited via hide/show + reorder (§3), NOT
// generated as content. Nav is a projection of these fields (§5.3).
// ---------------------------------------------------------------------------
export const blockPlacementSchema = z.object({
  anchor: z.string().optional(), // "#services" — one-page nav target
  navLabel: z.string().optional(), // "Послуги"
  showInNav: z.boolean().default(false),
  hidden: z.boolean().default(false), // hide/show the whole section (§3)
  // Per-block schema version for migrations (§4.6). Absent = v1.
  schemaVersion: z.number().int().optional(),
});
export type BlockPlacement = z.infer<typeof blockPlacementSchema>;

/** A block as persisted on a page: content + placement. */
export type StoredBlock = BlockInstance & BlockPlacement;

/**
 * Validate one stored block's props against the registry.
 * Render uses this per-block (with UnknownBlock fallback) so a single bad
 * block never crashes the whole site — while generation stays strict (§4.1).
 */
export function parseBlockProps(
  type: string,
  props: unknown,
):
  | { ok: true; type: BlockType; props: BlockProps[BlockType] }
  | { ok: false; error: z.ZodError | { message: string } } {
  if (!isBlockType(type)) {
    return { ok: false, error: { message: `Unknown block type: ${type}` } };
  }
  const result = blockSchemas[type].safeParse(props);
  if (!result.success) return { ok: false, error: result.error };
  return { ok: true, type, props: result.data };
}

// ---------------------------------------------------------------------------
// Fact paths for grounding (§4.4). Only these fields are `fact` (copied 1:1
// from the questionnaire and post-validated by string compare). Everything
// else is `creative` (AI may write it). "[]" marks a per-item array field.
// ---------------------------------------------------------------------------
export const factPaths: Record<BlockType, string[]> = {
  hero: [], // hero copy is all creative for MVP
  richText: [], // creative prose
  switchback: [], // creative storytelling + assets
  services: ["items[].name", "items[].price"],
  gallery: [], // images are assets, not text facts
  stats: [], // creative — but the prompt forbids inventing numbers
  testimonials: ["items[].quote", "items[].author", "items[].role"],
  faq: [], // creative — kept grounded by prompt
  cta: [], // creative marketing copy
  contacts: ["phone", "address", "hours", "email"],
};
