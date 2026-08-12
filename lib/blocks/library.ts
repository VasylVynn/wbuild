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
  /**
   * Item floor for a block that renders a repeating LIST or CARD GRID (owner
   * feedback 2026-08-10: «Наша тренерка» shipped as a card grid holding exactly
   * one card — a grid of one always reads as a bug, never as a design).
   *
   * ONE table, two consumers: `buildLibraryDoc` advertises it to the model, and
   * assemble() enforces it deterministically after generation — so the floor
   * can never be a suggestion the model quietly ignores.
   */
  minItems?: number;
  /**
   * What happens when the block lands below `minItems`:
   *  - "drop" — the section is removed (its content isn't worth a broken grid);
   *  - "keep" — the content IS valuable and genuine (the business really does
   *    have one master / one review / one service), so the DATA survives and the
   *    LAYOUT is what adapts: assemble picks a registered single-friendly
   *    variant where the wireframe offers one, and the wireframe's single-item
   *    render guard handles the rest. Never pad a grid with invented items —
   *    that would break invariant 5 to fix a CSS problem.
   */
  belowMin?: "drop" | "keep";
  /**
   * Force-injected by code into every page — NEVER offered to the model
   * (carries server-side wiring; presence is an invariant, not a creative
   * choice — §4.2/§5.6).
   */
  autoInjected?: boolean;
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
    // Mirrors the wireframe's non-repeatable `story` section: a second story
    // block would be silently dropped by assemble (sectionRepeatCap=1).
    maxPerPage: 1,
    inNav: false,
  },
  services: {
    label: "Послуги",
    description:
      "Список послуг/товарів: назва + опис (+ ціна, якщо вона є у фактах). Ядро сайту локального бізнесу. " +
      "Стільки позицій, скільки послуг/напрямків Є У ФАКТАХ (до 6) — НЕ додавай позицій, щоб було «повніше»: " +
      "вигадана послуга приводить заявку на те, чого бізнес не робить. Опис кожної — 2–3 речення про те, " +
      "як це відбувається і для кого. " +
      "Односкладові підписи («Тренування») не продають; ціни й тривалості — лише з фактів. " +
      "Можна двічі, коли позицій справді багато (основні + додаткові) — тоді з РІЗНИМИ заголовками.",
    role: "middle",
    maxPerPage: 2,
    inNav: true,
    navLabel: "Послуги",
    // A one-card services grid still reads as a bug, but services are the
    // funnel's core: the page must never lose the only description of what the
    // business sells → layout adapts (see belowMin: "keep").
    minItems: 2,
    belowMin: "keep",
  },
  gallery: {
    label: "Галерея",
    description: "Сітка фото реальних робіт. Візуальний доказ якості. Мінімум 2 фото.",
    role: "middle",
    maxPerPage: 1,
    inNav: true,
    navLabel: "Галерея",
    // Declared for the prompt only — deliberately no `belowMin`: assemble's own
    // gallery rule owns enforcement because it must also honour the
    // `pendingImages` shimmer placeholders of background image generation.
    minItems: 2,
  },
  stats: {
    label: "Цифри",
    description:
      "Кілька коротких акцентів-цифр (роки досвіду, к-сть замовлень тощо). ВИКОРИСТОВУВАТИ лише якщо числа " +
      "реально є у фактах; НІКОЛИ не вигадувати числа. Немає щонайменше двох справжніх чисел — не бери цю секцію.",
    role: "middle",
    maxPerPage: 1,
    inNav: false,
    minItems: 2,
    belowMin: "drop",
  },
  testimonials: {
    label: "Відгуки",
    description:
      "Реальні відгуки клієнтів (цитата + автор). Лише зі списку фактів; не вигадувати — ані тексту, ані автора. " +
      "Один справжній відгук — це нормально (код подасть його як велику цитату); двох вигаданих бути не може.",
    role: "middle",
    maxPerPage: 1,
    inNav: true,
    navLabel: "Відгуки",
    minItems: 2,
    belowMin: "keep",
  },
  faq: {
    label: "Питання-відповіді",
    description:
      "СПРАВЖНІ запитання клієнта перед покупкою. Два різні набори — не плутай їх. " +
      "МОЖНА завжди (відповідь — чесна проза про процес): як залишити заявку, що буде після заявки, " +
      "як проходить перше звернення, кому це підходить, як до вас дістатися своїми словами. " +
      "ЛИШЕ ЯКЩО ФАКТ Є: скільки коштує, скільки триває, як оплатити, чи можна перенести, де саме ви розташовані, " +
      "які години роботи. Немає факту — НЕ став це питання: краще 3 чесні питання, ніж 6 із вигаданими відповідями " +
      "(«заняття триває 60 хвилин», «перенести можна за добу» — це вигадана політика, і Google підтягне її у видачу). " +
      "Орієнтир 4–6 питань, коли фактів вистачає. Відповідь — 2–4 речення по суті. " +
      "НЕ пиши питань-пустушок («Чи якісна ваша робота?», «Чому саме ви?») — це наповнювач, який читається як спам.",
    role: "middle",
    maxPerPage: 1,
    inNav: true,
    navLabel: "Питання",
    minItems: 2,
    belowMin: "drop",
  },
  cta: {
    label: "Заклик до дії",
    description:
      "Смуга із закликом (напр. 'Замовити букет') + кнопка, що веде до контактів. Підштовхує до заявки.",
    role: "middle",
    maxPerPage: 1,
    inNav: false,
  },
  lead_form: {
    label: "Форма заявки",
    description:
      "Проста форма «Залишити заявку» (ім'я, телефон, повідомлення) — заявка падає власнику в Telegram. Додається автоматично на кожен сайт перед контактами.",
    role: "middle",
    maxPerPage: 1,
    inNav: true,
    navLabel: "Заявка",
    autoInjected: true,
  },
  contacts: {
    label: "Контакти",
    description:
      "Контакти текстом (телефон, адреса, години роботи, email) плюс кнопки месенджерів " +
      "viber і telegram. Заповнюй viber/telegram ЛИШЕ якщо є у наданих фактах бізнесу " +
      "(facts.viber / facts.telegram) — НІКОЛИ не вигадуй і не здогадуйся про нік чи номер " +
      "(§4.4, grounding). Якщо факту немає — залиш поле порожнім. Рівно один, завжди останній.",
    role: "closer",
    maxPerPage: 1,
    inNav: true,
    navLabel: "Контакти",
  },
  // ── Distinctive TEMPLATE sections (rendered only where a template defines a
  // section for them; on other templates the model omits them and code drops
  // any that slip through). Kept honest: use ONLY real business data. ──
  team: {
    label: "Команда",
    description:
      "Картки людей команди: ім'я + роль (+ короткий опис). ЛИШЕ реальні люди бізнесу; НІКОЛИ не вигадувати " +
      "імена, посади чи «колег» заради красивої сітки. Якщо людина одна — бери секцію з ОДНІЄЮ карткою " +
      "(код подасть її як портрет, а не як сітку з одного); це чесно й нормально.",
    role: "middle",
    maxPerPage: 1,
    inNav: true,
    navLabel: "Команда",
    minItems: 2,
    belowMin: "keep",
  },
  timeline: {
    label: "Як усе відбувається / шлях",
    description:
      "Кроки: етап + короткий опис (період — ЛИШЕ якщо реальна дата є у фактах). Найкраще працює як «як відбувається " +
      "візит/замовлення»: 3–5 кроків від першого контакту до результату. Кроки описуй по суті процесу, без вигаданих " +
      "тривалостей і дат.",
    role: "middle",
    maxPerPage: 1,
    inNav: false,
    minItems: 3,
    belowMin: "drop",
  },
  // ── DECISION 2026-08-10 (owner feedback, «Наш світ»): REDEFINED, not removed.
  // The block shipped a visible SEO keyword strip — «Теніс · Tennis · Тенісльвів
  // · Львів · Тренер з тенісу» — under a vague title. Two options were on the
  // table: delete it from the generation surface (the richText route), or
  // redefine it so it can only carry human-meaningful phrases.
  //
  // Redefinition wins for a SMALL-BUSINESS site: the wireframe already registers
  // this block as the `values` section labelled «Переваги» («ряд коротких тез»),
  // and a benefits strip — «Тренування під ваш рівень», «Зручний час занять» —
  // is genuinely useful above the lead form, especially for a business whose
  // source data is thin. Deleting the type would leave that section permanently
  // unreachable and remove a cheap way to add honest substance. What actually
  // failed was the CONTRACT (this description said «стрічка ключових слів»,
  // literally inviting keywords) — so the contract is what changed, backed by a
  // deterministic post-check in assemble() (cleanBenefitStrip) that drops
  // keyword-shaped items and the whole section when what's left is a tag cloud.
  // SEO belongs in prose, headings and metadata — never in visible chips.
  marquee: {
    label: "Переваги (короткі тези)",
    description:
      "Ряд коротких ТЕЗ про користь для клієнта — що людина отримує: «Тренування під ваш рівень», " +
      "«Зручний час занять», «Підтримка новачків». 4–8 пунктів, кожен — жива фраза з 2–5 слів українською. " +
      "ЗАБОРОНЕНО (код видаляє такі секції цілком): ключові слова й теги, хештеги, назви міст, англійські чи " +
      "транслітеровані дублі («Tennis», «Тенісльвів»), перелік послуг одним словом. Заголовок секції — зрозумілий " +
      "людині («Чому обирають нас», «Що ви отримуєте»), а не абстракція («Наш світ»).",
    role: "middle",
    maxPerPage: 1,
    inNav: false,
    // ONE number with marqueeSchema (`.min(3)`): the floor used to be 4 while
    // the schema admitted 3, so a clean, keyword-free three-thesis strip passed
    // tool validation and was then deleted by meetsItemFloor with no trace. The
    // schema keeps `.min(3)` because it also parses ALREADY STORED content
    // (editor saves) — so the floor comes down to meet it instead.
    minItems: 3,
    belowMin: "drop",
  },
  publications: {
    label: "Преса / публікації",
    description:
      "Список згадок у пресі, праць, статей чи кейсів: назва + рік + джерело. ЛИШЕ реальні, з фактів — " +
      "не вигадувати ані назв, ані видань, ані років. Немає щонайменше двох справжніх — не бери цю секцію.",
    role: "middle",
    maxPerPage: 1,
    inNav: true,
    navLabel: "Преса",
    minItems: 2,
    belowMin: "drop",
  },
  map: {
    label: "Карта",
    description:
      "Google-карта з адресою бізнесу та кнопкою «Прокласти маршрут». ЛИШЕ якщо у фактах є адреса " +
      "(код підставляє її 1:1 і прибирає блок без адреси). Доречна для закладів, куди приходять клієнти.",
    role: "middle",
    maxPerPage: 1,
    inNav: false,
  },
  instagram_cta: {
    label: "Instagram",
    description:
      "Помітний заклик «Написати в Direct» + нік і кількість підписників. ЛИШЕ якщо у фактах є Instagram " +
      "(код підставляє нік 1:1 і прибирає блок без ніку). ДОДАТОК до форми заявки, ніколи не замість неї — " +
      "доречний для бізнесів, що живуть в Instagram.",
    role: "middle",
    maxPerPage: 1,
    inNav: false,
  },
};

/** Composition constraints (guided freedom — owner decision 2026-07-07). */
export const COMPOSITION_RULES = {
  /** hero at index 0, contacts last. */
  opener: "hero" as BlockType,
  closer: "contacts" as BlockType,
  /**
   * Number of MIDDLE blocks (between hero and contacts). The floor moved 3 → 4
   * on owner feedback 2026-08-10: with sparse source data the model was landing
   * on the minimum and shipping a thin page. Thin input is not a licence for a
   * thin site — the substance it must add is honest generic prose (how it
   * works, what to expect, who it suits, FAQ), never invented specifics.
   */
  minMiddle: 4,
  maxMiddle: 8,
} as const;
