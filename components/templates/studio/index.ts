import type { ComponentType, ReactNode } from "react";
import type { BlockType } from "@/lib/blocks/schema";

import StudioWrapper from "./StudioWrapper";
import HeroSection from "./HeroSection";
import FeaturesSection from "./FeaturesSection";
import HowItWorksSection from "./HowItWorksSection";
import StudioTeam from "./StudioTeam";
import StudioGallery from "./StudioGallery";
import StatsSection from "./StatsSection";
import StudioBanner from "./StudioBanner";
import LeadFormSection from "./LeadFormSection";
import ContactsSection from "./ContactsSection";
import StudioHeroAlt from "./StudioHeroAlt";
import StudioHeroAlt2 from "./StudioHeroAlt2";
import StudioFeaturesAlt from "./StudioFeaturesAlt";
import StudioMarquee from "./StudioMarquee";
import StudioTimeline from "./StudioTimeline";
import StudioTestimonials from "./StudioTestimonials";
import StudioTestimonialsAlt from "./StudioTestimonialsAlt";
import StudioTestimonialsFeatured from "./StudioTestimonialsFeatured";
import StudioContactsSplit from "./StudioContactsSplit";
import StudioLeadFormBand from "./StudioLeadFormBand";

/**
 * A single section of the studio template.
 *  - `block`     — which of our block schemas feeds it (many sections may share
 *                  one block, e.g. features/howitworks both read `services`).
 *  - `label`     — Ukrainian name, for the editor/registry.
 *  - `navLabel`  — коротка мітка для навігації; відсутня → label.
 *  - `description` — one Ukrainian line, guidance for the generation model.
 *  - `component` — renders the section from `{ data }` (already-validated block
 *                  props, passed as `unknown`) plus an optional `extra` (only
 *                  the hero uses it: the stat-row items).
 */
export interface TemplateSectionDef {
  block: BlockType;
  label: string;
  /** Коротка мітка для навігації (щоб довгий label не ламав nav); відсутня → label. */
  navLabel?: string;
  description: string;
  component: ComponentType<{ data: unknown; extra?: unknown }>;
  /**
   * Alternate LAYOUTS of this same section (same block content, same design
   * language, different arrangement). A block carries a `variant` id chosen by
   * the MODEL per section (validated in code; falls back to `component` when
   * absent/unknown). Keeps every site visually distinct without new templates.
   */
  variants?: Record<string, ComponentType<{ data: unknown; extra?: unknown }>>;
}

export const studioSections: Record<string, TemplateSectionDef> = {
  hero: {
    block: "hero",
    label: "Головний екран",
    description:
      "Великий заголовок на темному тлі з градієнтними плямами, підзаголовок і до двох кнопок дії; опційний ряд показників.",
    component: HeroSection,
    variants: { split: StudioHeroAlt, minimal: StudioHeroAlt2 },
  },
  marquee: {
    block: "marquee",
    label: "Біжучий рядок",
    description:
      "Горизонтальна стрічка з короткими ключовими словами (напрями, спеціалізації, переваги), що плавно прокручується. Лише окремі слова чи короткі фрази — не речення; мінімум три.",
    component: StudioMarquee,
  },
  features: {
    block: "services",
    label: "Переваги",
    description: "Сітка карток з іконками — ключові переваги чи послуги, без цін.",
    component: FeaturesSection,
    variants: { list: StudioFeaturesAlt },
  },
  howitworks: {
    block: "services",
    label: "Як це працює",
    description: "Пронумеровані кроки процесу (01, 02, 03…); ціни ігноруються.",
    component: HowItWorksSection,
  },
  gallery: {
    block: "gallery",
    label: "Роботи",
    description: "Сітка зображень робіт із підписом (назва/категорія) на наведенні.",
    component: StudioGallery,
  },
  stats: {
    block: "stats",
    label: "Показники",
    description: "Смуга з числовими показниками та підписами (лише реальні цифри).",
    component: StatsSection,
  },
  timeline: {
    block: "timeline",
    label: "Хронологія",
    description:
      "Вертикальна стрічка етапів розвитку бізнесу чи процесу: період (рік), назва етапу, короткий опис. Лише реальні дати та події — не вигадуй хронологію.",
    component: StudioTimeline,
  },
  team: {
    block: "team",
    label: "Команда",
    description:
      "Картки команди — фото або ініціали, ім'я, роль (+ короткий опис). Лише реальні люди бізнесу.",
    component: StudioTeam,
  },
  testimonials: {
    block: "testimonials",
    label: "Відгуки",
    description:
      "Сітка карток з реальними відгуками клієнтів: цитата, ім'я автора, опційно роль. Цитати не вигадуються. Варіант «spotlight» — одна центрована колонка великих цитат; варіант «featured» — одна велика цитата плюс компактний список решти.",
    component: StudioTestimonials,
    variants: { spotlight: StudioTestimonialsAlt, featured: StudioTestimonialsFeatured },
  },
  banner: {
    block: "cta",
    label: "Смуга-твердження",
    navLabel: "Гасло",
    description:
      "Повноширинна смуга з великим твердженням/гаслом і підзаголовком — без кнопки, розриває ритм сторінки.",
    component: StudioBanner,
  },
  lead_form: {
    block: "lead_form",
    label: "Форма заявки",
    description:
      "Форма збору заявок — надсилає лід власнику в Telegram. Варіант «band» — широка смуга з інлайн-полями (імʼя й телефон поруч).",
    component: LeadFormSection,
    variants: { band: StudioLeadFormBand },
  },
  contacts: {
    block: "contacts",
    label: "Контакти",
    description:
      "Контактні дані та кнопки месенджерів (дзвінок / Viber / Telegram). Варіант «split» — інфо-сайдбар ліворуч і акцентна панель дій праворуч.",
    component: ContactsSection,
    variants: { split: StudioContactsSplit },
  },
};

export const studioMeta: {
  id: "studio";
  label: string;
  description: string;
  verticalIds: string[];
  order: string[];
  wrapper: ComponentType<{ children: ReactNode }>;
} = {
  id: "studio",
  label: "«Студія — темний преміум»",
  description:
    "Темний преміум-односторінник: глибокий майже-чорний фон, фіолетові акценти, чіткі мінімалістичні картки, тонкі анімації — технологічний, впевнений, дорогий настрій. Sans-типографіка.",
  verticalIds: ["generic", "lawyer", "autoservice"],
  order: [
    "hero",
    "marquee",
    "features",
    "howitworks",
    "gallery",
    "stats",
    "timeline",
    "team",
    "testimonials",
    "banner",
    "lead_form",
    "contacts",
  ],
  wrapper: StudioWrapper,
};
