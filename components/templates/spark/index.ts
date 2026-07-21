import type { ComponentType, ReactNode } from "react";
import type { TemplateBrand } from "@/lib/templates/registry";
import type { TemplateSectionDef } from "@/components/templates/studio";

import SparkWrapper from "./SparkWrapper";
import SparkHero, { SparkHeroCentered, SparkHeroSplit } from "./SparkHero";
import SparkAbout from "./SparkAbout";
import SparkServices, { SparkServicesList } from "./SparkServices";
import SparkSwitchback, { SparkSwitchbackCards } from "./SparkSwitchback";
import SparkMarquee from "./SparkMarquee";
import SparkStats, { SparkStatsCards } from "./SparkStats";
import SparkGallery, { SparkGalleryMasonry } from "./SparkGallery";
import SparkTimeline from "./SparkTimeline";
import SparkTestimonials, { SparkTestimonialsQuote } from "./SparkTestimonials";
import SparkFAQ, { SparkFAQAccordion } from "./SparkFAQ";
import SparkCTA from "./SparkCTA";
import SparkLeadForm from "./SparkLeadForm";
import SparkContacts from "./SparkContacts";

/**
 * Spark ("spark") — a clean universal-modern look ported from
 * template_sources/landing-pages-main (a config-driven landing-blocks system,
 * MIT). Its visual language: a shadcn "neutral" palette (near-black primary on a
 * white canvas), medium (not bold) headings with tight tracking, a signature
 * monospace-uppercase eyebrow, hairline borders, generous whitespace and quiet
 * card hovers. Ships LIGHT (default) + DARK, flipped by data-theme. Universal
 * (generic vertical) — reads the same block contract as every other template.
 */
export const sparkSections: Record<string, TemplateSectionDef> = {
  hero: {
    block: "hero",
    label: "Головний екран",
    description:
      "Чистий вступ: моноширинний eyebrow великими літерами, заголовок середньої жирності з акцентним хвостом (titleAccent), підзаголовок і дві кнопки; праворуч фото (imageUrl) у рамці або декоративна панель-сітка. Варіант centered — усе по центру, широке фото знизу; варіант split — асиметрична розкладка з високим фото ліворуч і ширшою колонкою тексту праворуч.",
    component: SparkHero,
    variants: { centered: SparkHeroCentered, split: SparkHeroSplit },
  },
  about: {
    block: "richText",
    label: "Про нас",
    description:
      "Стриманий текстовий блок по центру: заголовок і розповідь; порожній рядок ділить абзаци, рядки з «- » стають списком.",
    component: SparkAbout,
  },
  services: {
    block: "services",
    label: "Послуги",
    description:
      "Сітка карток послуг: назва, опис, ЦІНА моноширинним акцентом і опційний бейдж. Варіант list — стосований прайс-лист з ціною праворуч.",
    component: SparkServices,
    variants: { list: SparkServicesList },
  },
  switchback: {
    block: "switchback",
    label: "Історія у деталях",
    navLabel: "Історія",
    description:
      "Почергові рядки «фото + текст» (зиґзаґ): заголовок, розповідь і опційне посилання-стрілка. Фото беруться з props; без фото — тиха декоративна панель-сітка. Варіант cards — кроки як окремі картки в сітці з моноширинною нумерацією.",
    component: SparkSwitchback,
    variants: { cards: SparkSwitchbackCards },
  },
  marquee: {
    block: "marquee",
    label: "Ключові напрями",
    navLabel: "Напрями",
    description:
      "Горизонтальна стрічка коротких ключових слів моноширинним шрифтом (напрями, спеціалізації, цінності), з крапками-роздільниками, що плавно прокручується. Лише окремі слова, мінімум три.",
    component: SparkMarquee,
  },
  stats: {
    block: "stats",
    label: "Показники",
    description:
      "Тиха смуга показників: великі числа над дрібними підписами. Лише реальні цифри. Варіант cards — кожен показник в окремій рамці-картці.",
    component: SparkStats,
    variants: { cards: SparkStatsCards },
  },
  gallery: {
    block: "gallery",
    label: "Галерея робіт",
    navLabel: "Роботи",
    description:
      "Чиста сітка фото у рамці з підписом (назва/категорія), що зʼявляється на наведенні. Варіант masonry — мозаїка різної висоти.",
    component: SparkGallery,
    variants: { masonry: SparkGalleryMasonry },
  },
  timeline: {
    block: "timeline",
    label: "Наш шлях",
    description:
      "Вертикальна лінія з моноширинними номерами й картками кроків (період, заголовок, підзаголовок, опис) — процес, досвід або етапи. Лише реальні дати.",
    component: SparkTimeline,
  },
  testimonials: {
    block: "testimonials",
    label: "Відгуки",
    description:
      "Сітка карток-відгуків: цитата, ініціали-аватар, імʼя, роль. Варіант quote — кілька великих цитат по центру, лише реальні слова клієнтів.",
    component: SparkTestimonials,
    variants: { quote: SparkTestimonialsQuote },
  },
  faq: {
    block: "faq",
    label: "Питання та відповіді",
    navLabel: "Питання",
    description:
      "Питання й відповіді. Типово — відкритий читабельний список. Варіант accordion — розкривні блоки (працюють без JS), перший відкритий.",
    component: SparkFAQ,
    variants: { accordion: SparkFAQAccordion },
  },
  cta: {
    block: "cta",
    label: "Заклик до дії",
    description: "Смуга-заклик по центру на приглушеному тлі: заголовок, підзаголовок, суцільна кнопка.",
    component: SparkCTA,
  },
  lead_form: {
    block: "lead_form",
    label: "Форма заявки",
    description: "Форма збору заявок — надсилає лід власнику в Telegram.",
    component: SparkLeadForm,
  },
  contacts: {
    block: "contacts",
    label: "Контакти",
    description:
      "Контактні дані у картці: телефон, адреса, графік, email моноширинними мітками та кнопки месенджерів (дзвінок / Viber / Telegram).",
    component: SparkContacts,
  },
};

export const sparkMeta: {
  id: "spark";
  label: string;
  description: string;
  verticalIds: string[];
  order: string[];
  wrapper: ComponentType<{ children: ReactNode; brand?: TemplateBrand }>;
} = {
  id: "spark",
  label: "«Спарк» — чистий універсальний модерн",
  description:
    "Чистий універсальний модерн: біле полотно, майже-чорний акцент, заголовки середньої жирності з тісним трекінгом, моноширинні eyebrow-мітки, тонкі лінії та багато повітря. Світла й темна теми. Універсальний стиль для будь-якого бізнесу.",
  verticalIds: ["generic"],
  order: [
    "hero",
    "about",
    "services",
    "switchback",
    "marquee",
    "stats",
    "gallery",
    "timeline",
    "testimonials",
    "faq",
    "cta",
    "lead_form",
    "contacts",
  ],
  wrapper: SparkWrapper,
};
