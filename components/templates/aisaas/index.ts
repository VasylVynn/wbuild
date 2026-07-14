import type { ComponentType, ReactNode } from "react";
import type { TemplateSectionDef } from "@/lib/templates/registry";

import AiSaasWrapper from "./AiSaasWrapper";
import AiSaasHero from "./AiSaasHero";
import AiSaasHighlights from "./AiSaasHighlights";
import AiSaasMarquee from "./AiSaasMarquee";
import AiSaasProcess from "./AiSaasProcess";
import AiSaasStats from "./AiSaasStats";
import AiSaasTestimonials from "./AiSaasTestimonials";
import AiSaasFAQ from "./AiSaasFAQ";
import AiSaasCTA from "./AiSaasCTA";
import AiSaasLeadForm from "./AiSaasLeadForm";
import AiSaasContacts from "./AiSaasContacts";

/**
 * AI-SaaS ("ai-saas-landing") — a light, soft-pastel SaaS look (lavender canvas,
 * coral/peach/blue accents, big rounded shapes, Quicksand) ported from
 * template_sources/AI-SaaS-landing-page-template. Single light theme; a
 * product-led composition: feature BENTO → logos marquee → how-it-works PROCESS.
 */
export const aisaasSections: Record<string, TemplateSectionDef> = {
  hero: {
    block: "hero",
    label: "Головний екран",
    description:
      "М'який pastel-екран: бейдж, великий заголовок із опційним кораловим акцентом, підзаголовок, дві округлі кнопки, дот-сітка й градієнтні плями.",
    component: AiSaasHero,
  },
  highlights: {
    block: "services",
    label: "Переваги (bento)",
    description:
      "Bento-сітка ціннісних пропозицій «чому ми» — асиметричні плитки з іконками, назва й опис; ціни ігноруються.",
    component: AiSaasHighlights,
  },
  marquee: {
    block: "marquee",
    label: "Стрічка",
    description:
      "Рухома стрічка коротких ключових слів (інтеграції / переваги / напрямки). Лише реальні.",
    component: AiSaasMarquee,
  },
  process: {
    block: "timeline",
    label: "Як це працює",
    description:
      "Пронумеровані кроки «як це працює» (01, 02, 03…) — етап, короткий опис.",
    component: AiSaasProcess,
  },
  stats: {
    block: "stats",
    label: "Показники",
    description: "Сітка показників великими цифрами (лише реальні дані).",
    component: AiSaasStats,
  },
  testimonials: {
    block: "testimonials",
    label: "Відгуки",
    description: "М'які картки відгуків — цитата, автор, роль.",
    component: AiSaasTestimonials,
  },
  faq: {
    block: "faq",
    label: "Питання та відповіді",
    description: "Акордеон із питаннями та відповідями (одне відкрите).",
    component: AiSaasFAQ,
  },
  cta: {
    block: "cta",
    label: "Заклик до дії",
    description: "Фінальний pastel-блок: заголовок, підзаголовок і коралова кнопка.",
    component: AiSaasCTA,
  },
  lead_form: {
    block: "lead_form",
    label: "Форма заявки",
    description: "Форма збору заявок — надсилає лід власнику в Telegram.",
    component: AiSaasLeadForm,
  },
  contacts: {
    block: "contacts",
    label: "Контакти",
    description: "Контактні дані та кнопки месенджерів (дзвінок / Viber / Telegram).",
    component: AiSaasContacts,
  },
};

export const aisaasMeta: {
  id: "aisaas";
  label: string;
  description: string;
  verticalIds: string[];
  order: string[];
  wrapper: ComponentType<{ children: ReactNode }>;
} = {
  id: "aisaas",
  label: "«AI-SaaS — світлий pastel»",
  description:
    "Світлий м'який SaaS-стиль: лавандове полотно, коралові/персикові/блакитні пастелі, великі округлі форми, дружній шрифт Quicksand — сучасний, привітний, «стартаповий», легкий і доступний.",
  verticalIds: ["generic"],
  order: [
    "hero",
    "highlights",
    "marquee",
    "process",
    "stats",
    "testimonials",
    "faq",
    "cta",
    "lead_form",
    "contacts",
  ],
  wrapper: AiSaasWrapper,
};
