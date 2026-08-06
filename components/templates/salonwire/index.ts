import type { ComponentType, ReactNode } from "react";
import type { TemplateBrand } from "@/lib/templates/registry";
import type { TemplateSectionDef } from "@/components/templates/studio";
import { SalonWireWrapper } from "./SalonWireWrapper";
import {
  WireContacts,
  WireCta,
  WireFaq,
  WireGallery,
  WireHero,
  WireHeroBanner,
  WireHeroMirror,
  WireInstagramCta,
  WireLeadForm,
  WireMap,
  WireMarquee,
  WirePublications,
  WireServices,
  WireStats,
  WireSwitchback,
  WireTeam,
  WireTestimonials,
  WireTimeline,
} from "./sections";

/**
 * salonwire — a STRUCTURAL wireframe (design spike, 2026-07-27).
 *
 * The `salon` template's section inventory and layout logic, with every visual
 * decision stripped out: greys, no shadows, no radii, no motion, no decorative
 * sections (Aurora/Particles/Marquee/OrganicShapes are style, not structure).
 *
 * It exists to answer one question: if a model is handed a responsive skeleton
 * and full freedom over surface, does it produce genuinely distinct designs per
 * business? Not a production template — it is deliberately ugly until styled.
 */
export const salonwireSections: Record<string, TemplateSectionDef> = {
  hero: {
    block: "hero",
    label: "Головний екран",
    description:
      "Каркас героя: eyebrow, заголовок, підзаголовок, дві кнопки, фото. Три макети: " +
      "split — фото праворуч (універсальний); mirror — дзеркальний, фото ліворуч; " +
      "banner — фото на весь екран тлом зі світлим текстом по центру (лише для сильного " +
      "атмосферного фото без напису; без фото стає центрованим текстовим екраном).",
    component: WireHero,
    // `split` is registered explicitly as well as being the default component,
    // so the model and the seeded fallback can NAME the layout they mean.
    variants: { split: WireHero, mirror: WireHeroMirror, banner: WireHeroBanner },
  },
  services: {
    block: "services",
    label: "Послуги",
    description: "Каркас послуг: сітка карток — назва, опис, ціна.",
    component: WireServices,
  },
  story: {
    block: "switchback",
    label: "Історія",
    description: "Каркас зиг-загу: рядки текст+фото, сторона фото чергується через --wire-split-order.",
    component: WireSwitchback,
  },
  process: {
    block: "timeline",
    label: "Як відбувається візит",
    navLabel: "Візит",
    description: "Каркас кроків візиту: нумерований список карток.",
    component: WireTimeline,
  },
  gallery: {
    block: "gallery",
    label: "Галерея",
    description: "Каркас галереї: сітка фото з опційними підписами.",
    component: WireGallery,
  },
  team: {
    block: "team",
    label: "Команда",
    description: "Каркас команди: сітка карток — фото, імʼя, роль, біо.",
    component: WireTeam,
  },
  testimonials: {
    block: "testimonials",
    label: "Відгуки",
    description: "Каркас відгуків: сітка цитат з автором і роллю.",
    component: WireTestimonials,
  },
  faq: {
    block: "faq",
    label: "Питання та відповіді",
    navLabel: "Питання",
    description: "Каркас FAQ: нативні details/summary.",
    component: WireFaq,
  },
  lead_form: {
    block: "lead_form",
    label: "Форма заявки",
    description: "Каркас форми: імʼя, телефон, повідомлення, кнопка.",
    component: WireLeadForm,
  },
  contacts: {
    block: "contacts",
    label: "Контакти",
    description: "Каркас контактів: сітка карток — телефон, адреса, години, email.",
    component: WireContacts,
  },
  stats: {
    block: "stats",
    label: "Цифри",
    description: "Каркас статистики: ряд великих чисел із підписами.",
    component: WireStats,
  },
  cta: {
    block: "cta",
    label: "Заклик до дії",
    description: "Каркас CTA-смуги: заголовок, підзаголовок, одна кнопка.",
    component: WireCta,
  },
  values: {
    block: "marquee",
    label: "Переваги",
    description: "Каркас переваг: ряд коротких тез.",
    component: WireMarquee,
  },
  press: {
    block: "publications",
    label: "Преса",
    description: "Каркас згадок у пресі: картки — джерело, заголовок, рік.",
    component: WirePublications,
  },
  map: {
    block: "map",
    label: "Карта",
    description: "Каркас карти: адреса й місце під вбудовану карту.",
    component: WireMap,
  },
  instagram_cta: {
    block: "instagram_cta",
    label: "Instagram",
    description: "Каркас Instagram-CTA: нік, підписники, кнопка в Direct.",
    component: WireInstagramCta,
  },
};

export const salonwireMeta: {
  id: "salonwire";
  label: string;
  description: string;
  verticalIds: string[];
  order: string[];
  wrapper: ComponentType<{ children: ReactNode; brand?: TemplateBrand }>;
} = {
  id: "salonwire",
  label: "«Каркас» — структура без стилю (експеримент)",
  description:
    "Структурний каркас без жодного візуального рішення: сірі поверхні, без тіней, радіусів і анімацій. Призначений для того, щоб стиль дописала модель під конкретний бізнес. НЕ пропонувати власникам як готовий дизайн.",
  verticalIds: [],
  // A composition HINT only. The whole point of this spike is that the model
  // picks which sections a business needs and in what order — this list exists
  // because `SiteTemplate` requires one, and it covers all 16 block types so
  // nothing in the library is unreachable.
  order: [
    "hero",
    "stats",
    "services",
    "story",
    "process",
    "gallery",
    "values",
    "team",
    "press",
    "testimonials",
    "instagram_cta",
    "faq",
    "cta",
    "map",
    "lead_form",
    "contacts",
  ],
  wrapper: SalonWireWrapper,
};
