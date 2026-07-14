import type { ComponentType, ReactNode } from "react";
import type { TemplateBrand } from "@/lib/templates/registry";
import type { TemplateSectionDef } from "@/components/templates/studio";

import React2021Wrapper from "./React2021Wrapper";
import React2021Hero from "./React2021Hero";
import React2021Process from "./React2021Process";
import React2021Services from "./React2021Services";
import React2021Marquee from "./React2021Marquee";
import React2021Stats from "./React2021Stats";
import React2021CTA from "./React2021CTA";
import React2021LeadForm from "./React2021LeadForm";
import React2021Contacts from "./React2021Contacts";

/**
 * React-2021 ("react2021") — an energetic, coral-accented landing look (Rubik,
 * white canvas, coral #ec4755 / dark-ink #1a2e35, coral wave separators,
 * alternating-word headings, coral-bordered icon squares) translated into our
 * stack from template_sources/react-landing-page-template-2021. Single light
 * theme; punchy and lean: product PROCESS → features → keyword marquee → cta.
 */
export const react2021Sections: Record<string, TemplateSectionDef> = {
  hero: {
    block: "hero",
    label: "Головний екран",
    description:
      "Ліво-вирівняний екран: великий extrabold-заголовок із кораловим акцентним рядком, підзаголовок, коралова + контурна кнопки; праворуч зображення (imageUrl) з діагональним зрізом, унизу — коралова хвиля.",
    component: React2021Hero,
  },
  process: {
    block: "timeline",
    label: "Як це працює",
    description:
      "Пронумеровані кроки (01, 02, 03…) з кораловими цифрами — етап, короткий опис.",
    component: React2021Process,
  },
  services: {
    block: "services",
    label: "Послуги",
    description:
      "Сітка послуг у стилі «features»: квадратні іконки з кораловою рамкою, назва, опис, ціна.",
    component: React2021Services,
  },
  marquee: {
    block: "marquee",
    label: "Стрічка",
    description:
      "Рухома коралова стрічка коротких ключових слів (переваги / напрямки). Лише реальні.",
    component: React2021Marquee,
  },
  stats: {
    block: "stats",
    label: "Показники",
    description: "Сітка показників великими кораловими цифрами (лише реальні дані).",
    component: React2021Stats,
  },
  cta: {
    block: "cta",
    label: "Заклик до дії",
    description: "Коралова смуга: заголовок, підзаголовок і світла кнопка.",
    component: React2021CTA,
  },
  lead_form: {
    block: "lead_form",
    label: "Форма заявки",
    description: "Форма збору заявок — надсилає лід власнику в Telegram.",
    component: React2021LeadForm,
  },
  contacts: {
    block: "contacts",
    label: "Контакти",
    description: "Контактні дані та кнопки месенджерів (дзвінок / Viber / Telegram).",
    component: React2021Contacts,
  },
};

export const react2021Meta: {
  id: "react2021";
  label: string;
  description: string;
  verticalIds: string[];
  order: string[];
  wrapper: ComponentType<{ children: ReactNode; brand?: TemplateBrand }>;
} = {
  id: "react2021",
  label: "«React-2021 — енергійний кораловий лендинг»",
  description:
    "Енергійний, світлий лендинг: коралово-червоний акцент (#ec4755), білий фон, шрифт Rubik, хвилясті коралові розділювачі секцій, заголовки з чергуванням кольору слів, квадратні іконки з кораловою рамкою — жвавий, сучасний, «продуктовий/стартаповий», привертає увагу та передає динаміку.",
  verticalIds: ["generic"],
  order: [
    "hero",
    "process",
    "services",
    "marquee",
    "stats",
    "cta",
    "lead_form",
    "contacts",
  ],
  wrapper: React2021Wrapper,
};
