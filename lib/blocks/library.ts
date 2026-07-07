import type { BlockType } from "./schema";

/**
 * Block library for AI composition (Phase 2). The generator composes a page by
 * PICKING blocks from this library — variable count and order — instead of
 * filling a fixed preset. Every block is still validated against the registry
 * (§4.1), so structure is COMPOSED, never hallucinated. The composition rules
 * here are also enforced in code after generation (lib/ai/compose.ts).
 *
 * This is the "розширений режим" the brief deferred in §4.2, pulled forward by
 * the owner: different businesses get different section sets/orders, not one
 * template.
 */
export interface BlockLibraryEntry {
  label: string;
  /** What the block is + when the AI should use it. Shown to the model. */
  description: string;
  /** Fixed position, if any. */
  role: "opener" | "closer" | "middle";
  /** Max times it may appear on one page. */
  maxPerPage: number;
  /** Whether it appears in the projected nav (§5.3) when present. */
  inNav: boolean;
  /** Nav label used when inNav (Ukrainian). */
  navLabel?: string;
}

export const blockLibrary: Record<BlockType, BlockLibraryEntry> = {
  hero: {
    label: "Головний банер",
    description:
      "Великий банер угорі: слоган + підзаголовок + фонове фото. Перше враження. Рівно один, завжди перший.",
    role: "opener",
    maxPerPage: 1,
    inNav: false,
  },
  richText: {
    label: "Текст (заголовок + опис)",
    description:
      "Проста текстова секція: заголовок і кілька абзаців. Для 'Про нас', вступу, філософії, історії бренду.",
    role: "middle",
    maxPerPage: 2,
    inNav: false,
  },
  switchback: {
    label: "Зигзаг (фото + текст)",
    description:
      "Рядки, де фото й текст чергуються ліворуч/праворуч. Для сторітелінгу: майстерня, процес роботи, індивідуальні замовлення, переваги.",
    role: "middle",
    maxPerPage: 2,
    inNav: false,
  },
  services: {
    label: "Послуги",
    description:
      "Список послуг/товарів з назвами, описами й цінами. Ядро сайту локального бізнесу.",
    role: "middle",
    maxPerPage: 1,
    inNav: true,
    navLabel: "Послуги",
  },
  gallery: {
    label: "Галерея",
    description: "Сітка фото реальних робіт. Візуальний доказ якості.",
    role: "middle",
    maxPerPage: 1,
    inNav: true,
    navLabel: "Галерея",
  },
  stats: {
    label: "Цифри",
    description:
      "Кілька коротких акцентів-цифр (роки досвіду, к-сть замовлень тощо). ВИКОРИСТОВУВАТИ лише якщо число реально є у фактах; НІКОЛИ не вигадувати числа.",
    role: "middle",
    maxPerPage: 1,
    inNav: false,
  },
  testimonials: {
    label: "Відгуки",
    description:
      "Реальні відгуки клієнтів (цитата + автор). Лише зі списку фактів; не вигадувати.",
    role: "middle",
    maxPerPage: 1,
    inNav: true,
    navLabel: "Відгуки",
  },
  faq: {
    label: "Питання-відповіді",
    description:
      "Поширені запитання й відповіді (доставка, оплата, терміни). Знімає заперечення клієнта.",
    role: "middle",
    maxPerPage: 1,
    inNav: true,
    navLabel: "Питання",
  },
  cta: {
    label: "Заклик до дії",
    description:
      "Смуга із закликом (напр. 'Замовити букет') + кнопка, що веде до контактів. Підштовхує до заявки.",
    role: "middle",
    maxPerPage: 1,
    inNav: false,
  },
  contacts: {
    label: "Контакти",
    description: "Контакти текстом: телефон, адреса, години роботи. Рівно один, завжди останній.",
    role: "closer",
    maxPerPage: 1,
    inNav: true,
    navLabel: "Контакти",
  },
};

/** Composition constraints (guided freedom — owner decision 2026-07-07). */
export const COMPOSITION_RULES = {
  /** hero at index 0, contacts last. */
  opener: "hero" as BlockType,
  closer: "contacts" as BlockType,
  /** number of MIDDLE blocks (between hero and contacts). */
  minMiddle: 3,
  maxMiddle: 7,
} as const;
