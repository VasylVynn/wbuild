import { z } from "zod";

/**
 * Block registry contract — the single source of truth (brief §4.1).
 *
 * The SAME schemas drive: server render, generation validation, the editing
 * form (Puck-style: fields → UI), the AI tool description, and nav anchors.
 * Nothing may drift from this file.
 *
 * MVP vertical: florist. Preset `florist` = [hero, services, gallery,
 * testimonials, contacts]. `lead_form` is intentionally OUT of MVP (§15).
 * contacts is textual (phone/address/hours/email) PLUS one-tap messenger
 * buttons (call/Viber/Telegram) — see lib/blocks/contact-links.ts for the
 * href normalization and components/blocks/Contacts.tsx for the buttons.
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
  // Optional second-colour accent phrase shown after the title on its own line
  // (the studio template's signature two-tone violet headline). Skins that don't
  // use it simply ignore it.
  titleAccent: z
    .string()
    .optional()
    .describe(
      "Короткий акцентний ХВІСТ заголовка (інший колір, окремий рядок). Це ПРОДОВЖЕННЯ title, НЕ повтор — не дублюй у ньому слова з title. Напр.: title «Ваш автомобіль у надійних», titleAccent «руках».",
    ),
  subtitle: z.string().optional(),
  imageUrl: assetUrl.optional(),
  // Alt text of the hero image (D3). At generation it is ALWAYS assigned
  // deterministically from facts (the model never sees images — §4.8 — so a
  // model-written photo description would be fabrication); the owner can edit
  // it in the form, and wave G's vision analysis will propose better ones.
  imageAlt: z.string().optional().describe("Alt-текст hero-зображення (заповнюється кодом, не вигадуй опис фото)"),
  ctaLabel: z.string().optional(),
  ctaHref: z.string().optional(), // usually an in-page anchor like "#contacts"
  // Optional second (outline) CTA — template-mining wave 2.
  secondaryCtaLabel: z.string().optional(),
  secondaryCtaHref: z.string().optional(),
});

// ---------------------------------------------------------------------------
// services
// ---------------------------------------------------------------------------
// Icon vocabulary for service items (inline SVGs in components/blocks/icons.tsx).
// An enum (not free string) so the editor form renders a select and the model
// can't invent icon names.
export const SERVICE_ICONS = [
  "star",
  "heart",
  "shield",
  "clock",
  "truck",
  "wrench",
  "leaf",
  "award",
  "phone",
  "check",
  "sparkles",
  "users",
] as const;

export const serviceItemSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.string().optional(), // free-form ("від 500 грн") — a fact, copied 1:1
  imageUrl: assetUrl.optional(),
  icon: z.enum(SERVICE_ICONS).optional().describe("Іконка пункту (для скінів без фото/цін)"),
  badge: z.string().max(24).optional().describe("Короткий бейдж, напр. «Популярне»"),
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
  // Optional hover caption (title + small category label) — wave 2.
  title: z.string().optional(),
  category: z.string().optional(),
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
// contacts (textual info + one-tap messenger buttons)
// ---------------------------------------------------------------------------
export const contactsSchema = z.object({
  title: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  hours: z.string().optional(),
  email: z.string().optional(),
  // Freeform phone number, any formatting — normalized in contact-links.ts.
  viber: z.string().optional(),
  // Username (with/without "@") or a phone number — normalized in contact-links.ts.
  telegram: z.string().optional(),
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
  // Optional inline CTA under the text — template-mining wave 2.
  buttonLabel: z.string().optional(),
  buttonHref: z.string().optional(),
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
// lead_form — the ONLY block with a server-side submit handler (§5.6). It is
// force-injected into every generated site (never offered to the model) and
// posts to /api/leads, which pushes the lead to the owner's Telegram.
// ---------------------------------------------------------------------------
export const leadFormSchema = z.object({
  title: z.string().optional(),
  subtitle: z.string().optional(),
  buttonLabel: z.string().optional(),
});

// ---------------------------------------------------------------------------
// team — real people of the business (staff / masters / experts). Template-only
// section content. Photos are model-invented → grounded/stripped like gallery.
// ---------------------------------------------------------------------------
export const teamMemberSchema = z.object({
  name: z.string().min(1),
  role: z.string().optional(),
  photo: assetUrl.optional(),
  bio: z.string().optional(),
});
export const teamSchema = z.object({
  title: z.string().optional(),
  items: z.array(teamMemberSchema).min(1),
});

// ---------------------------------------------------------------------------
// timeline — experience / journey / process: period + step (only real dates).
// ---------------------------------------------------------------------------
export const timelineItemSchema = z.object({
  period: z.string().optional(),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  description: z.string().optional(),
});
export const timelineSchema = z.object({
  title: z.string().optional(),
  items: z.array(timelineItemSchema).min(1),
});

// ---------------------------------------------------------------------------
// marquee — a scrolling strip of short keywords (skills / tech / directions).
// ---------------------------------------------------------------------------
export const marqueeSchema = z.object({
  title: z.string().optional(),
  items: z.array(z.string().min(1)).min(3),
});

// ---------------------------------------------------------------------------
// publications — works / books / articles / cases: title + year + source.
// ---------------------------------------------------------------------------
export const publicationItemSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().optional(),
  year: z.string().optional(),
  source: z.string().optional(),
});
export const publicationsSchema = z.object({
  title: z.string().optional(),
  items: z.array(publicationItemSchema).min(1),
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
  lead_form: leadFormSchema,
  contacts: contactsSchema,
  team: teamSchema,
  timeline: timelineSchema,
  marquee: marqueeSchema,
  publications: publicationsSchema,
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

// Section id of the source TEMPLATE this block was composed from (§templates).
// Absent on pack/legacy sites — the renderer then keys on the block type. Shared
// by the model-emitted instance AND the stored placement so it round-trips.
const sectionField = z
  .string()
  .optional()
  .describe("id секції шаблону, з якої взято цей блок (лише для сайтів на шаблоні)");

// Layout variant of the template section the model chose (e.g. "split",
// "minimal"). Optional — absent means the section's default layout. The renderer
// falls back to default for unknown ids; code re-validates it against the section.
const variantField = z
  .string()
  .optional()
  .describe("id layout-варіанту обраної секції (напр. split/minimal); пропусти для типового");

// ---------------------------------------------------------------------------
// Block instance (what the AI generates: type + validated props).
// A discriminated union so generation output is strictly validated (§4.3).
// `section` (optional) lets the model tag a block with the template section it
// fills; ignored on pack sites and stripped/validated in code either way.
// ---------------------------------------------------------------------------
export const blockInstanceSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("hero"), props: heroSchema, section: sectionField, variant: variantField }),
  z.object({ type: z.literal("richText"), props: richTextSchema, section: sectionField, variant: variantField }),
  z.object({ type: z.literal("switchback"), props: switchbackSchema, section: sectionField, variant: variantField }),
  z.object({ type: z.literal("services"), props: servicesSchema, section: sectionField, variant: variantField }),
  z.object({ type: z.literal("gallery"), props: gallerySchema, section: sectionField, variant: variantField }),
  z.object({ type: z.literal("stats"), props: statsSchema, section: sectionField, variant: variantField }),
  z.object({ type: z.literal("testimonials"), props: testimonialsSchema, section: sectionField, variant: variantField }),
  z.object({ type: z.literal("faq"), props: faqSchema, section: sectionField, variant: variantField }),
  z.object({ type: z.literal("cta"), props: ctaSchema, section: sectionField, variant: variantField }),
  z.object({ type: z.literal("lead_form"), props: leadFormSchema, section: sectionField, variant: variantField }),
  z.object({ type: z.literal("contacts"), props: contactsSchema, section: sectionField, variant: variantField }),
  z.object({ type: z.literal("team"), props: teamSchema, section: sectionField, variant: variantField }),
  z.object({ type: z.literal("timeline"), props: timelineSchema, section: sectionField, variant: variantField }),
  z.object({ type: z.literal("marquee"), props: marqueeSchema, section: sectionField, variant: variantField }),
  z.object({ type: z.literal("publications"), props: publicationsSchema, section: sectionField, variant: variantField }),
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
  // Presentation variant («скін») — layout-only, never content. Absent = default.
  // Mutually exclusive with `section`: template sites carry `section`, pack sites
  // carry `skin`.
  skin: z.string().optional(),
  // Template section this block belongs to (see blockInstanceSchema). Absent on
  // pack/legacy sites — the renderer then keys on the block type.
  section: sectionField,
  // Alternate LAYOUT of the section (template sites only): the MODEL chooses it
  // per section; code validates it against the section and the renderer falls
  // back to the default component when absent/unknown. Presentation-only, like skin.
  variant: z
    .string()
    .optional()
    .describe("варіант layout секції шаблону (обраний моделлю; фолбек — типовий layout)"),
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
  lead_form: [], // labels only; submitted data goes to /api/leads, not props
  contacts: ["phone", "address", "hours", "email", "viber", "telegram"],
  team: [], // real people — kept honest by the prompt, not string-compared
  timeline: [], // real dates/steps — kept honest by the prompt
  marquee: [], // short real keywords — kept honest by the prompt
  publications: [], // real works — kept honest by the prompt
};
