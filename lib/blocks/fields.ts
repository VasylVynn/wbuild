import { z } from "zod";
import { blockSchemas, type BlockType } from "./schema";

/**
 * Editing form derived FROM the block schema (§3 invariant: one registry
 * drives render + validation + AI description + the editing form — they cannot
 * drift). We introspect the Zod prop schemas into flat field descriptors the
 * editor bottom-sheet renders. Supported shapes cover the whole registry:
 * strings (optional), enums, and arrays of flat string objects.
 */

export type FieldKind = "text" | "textarea" | "image" | "select";

export interface FieldDescriptor {
  key: string;
  label: string;
  kind: FieldKind;
  options?: string[]; // for select
}

export interface ArrayFieldDescriptor {
  key: string;
  label: string;
  kind: "array";
  itemFields: FieldDescriptor[];
}

export type AnyFieldDescriptor = FieldDescriptor | ArrayFieldDescriptor;

// Ukrainian labels for known prop keys (fallback: the key itself).
const LABELS: Record<string, string> = {
  eyebrow: "Надзаголовок",
  title: "Заголовок",
  subtitle: "Підзаголовок",
  body: "Текст",
  align: "Вирівнювання",
  ctaLabel: "Текст кнопки",
  ctaHref: "Посилання кнопки",
  buttonLabel: "Текст кнопки",
  buttonHref: "Посилання кнопки",
  imageUrl: "Зображення",
  url: "Зображення",
  alt: "Опис зображення",
  imageAlt: "Опис зображення (alt)",
  name: "Назва",
  description: "Опис",
  price: "Ціна",
  quote: "Відгук",
  author: "Автор",
  role: "Хто це",
  question: "Питання",
  answer: "Відповідь",
  value: "Число",
  label: "Підпис",
  heading: "Заголовок",
  items: "Елементи",
  images: "Фото",
  phone: "Телефон",
  address: "Адреса",
  hours: "Години роботи",
  email: "Email",
  viber: "Viber (номер)",
  telegram: "Telegram (нік або номер)",
  instagram: "Instagram (нік або посилання)",
  handle: "Instagram (нік)",
};

const TEXTAREA_KEYS = new Set(["body", "description", "quote", "answer", "message", "subtitle"]);
const IMAGE_KEYS = new Set(["imageUrl", "url"]);

function labelFor(key: string): string {
  return LABELS[key] ?? key;
}

function unwrap(schema: z.ZodType): z.ZodType {
  let s = schema;
  while (s instanceof z.ZodOptional || s instanceof z.ZodDefault) {
    s = (s instanceof z.ZodOptional ? s.unwrap() : s.def.innerType) as z.ZodType;
  }
  return s;
}

function scalarDescriptor(key: string, schema: z.ZodType): FieldDescriptor | null {
  const s = unwrap(schema);
  if (s instanceof z.ZodEnum) {
    return { key, label: labelFor(key), kind: "select", options: s.options as string[] };
  }
  if (s instanceof z.ZodString) {
    if (IMAGE_KEYS.has(key)) return { key, label: labelFor(key), kind: "image" };
    return { key, label: labelFor(key), kind: TEXTAREA_KEYS.has(key) ? "textarea" : "text" };
  }
  return null; // numbers/booleans in placement are not edited via the sheet
}

/** Flat field descriptors for a block type's props. */
export function getBlockFields(type: BlockType): AnyFieldDescriptor[] {
  const schema = blockSchemas[type];
  if (!(schema instanceof z.ZodObject)) return [];
  const out: AnyFieldDescriptor[] = [];

  for (const [key, raw] of Object.entries(schema.shape as Record<string, z.ZodType>)) {
    const s = unwrap(raw);
    if (s instanceof z.ZodArray) {
      const el = unwrap(s.element as z.ZodType);
      if (el instanceof z.ZodObject) {
        const itemFields: FieldDescriptor[] = [];
        for (const [ik, irs] of Object.entries(el.shape as Record<string, z.ZodType>)) {
          const d = scalarDescriptor(ik, irs);
          if (d) itemFields.push(d);
        }
        out.push({ key, label: labelFor(key), kind: "array", itemFields });
      }
      continue;
    }
    const d = scalarDescriptor(key, raw);
    if (d) out.push(d);
  }
  return out;
}
