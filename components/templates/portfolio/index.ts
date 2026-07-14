import type { ComponentType, ReactNode } from "react";
import type { TemplateSectionDef } from "@/lib/templates/registry";

import PortfolioWrapper from "./PortfolioWrapper";
import PortfolioHero from "./PortfolioHero";
import PortfolioMarquee from "./PortfolioMarquee";
import PortfolioAbout from "./PortfolioAbout";
import PortfolioGallery from "./PortfolioGallery";
import PortfolioTimeline from "./PortfolioTimeline";
import PortfolioBanner from "./PortfolioBanner";
import PortfolioTestimonials from "./PortfolioTestimonials";
import PortfolioLeadForm from "./PortfolioLeadForm";
import PortfolioContacts from "./PortfolioContacts";

/**
 * Portfolio ("portfolio-ui-6") — a dark tech look — near-black teal-accented
 * background, glassmorphism + neon glow, Inter with a Playfair serif accent —
 * ported from template_sources/Portfolio-Landing-Page-6. Single dark theme.
 * Work-led: skills marquee → projects → journey timeline → a statement BANNER.
 */
export const portfolioSections: Record<string, TemplateSectionDef> = {
  hero: {
    block: "hero",
    label: "Головний екран",
    description:
      "Спліт-екран: скляний бейдж, великий заголовок із курсивним serif-акцентом, підзаголовок, дві кнопки й опційне фото у скляній картці з підсвіткою.",
    component: PortfolioHero,
  },
  marquee: {
    block: "marquee",
    label: "Стрічка навичок",
    description: "Рухома стрічка коротких ключових слів (навички / технології / напрямки). Лише реальні.",
    component: PortfolioMarquee,
  },
  about: {
    block: "richText",
    label: "Про нас",
    description: "Заголовок і текст; рядки з «- » стають списком.",
    component: PortfolioAbout,
  },
  gallery: {
    block: "gallery",
    label: "Роботи",
    description: "Сітка проєктів/робіт із підписом (назва/категорія) на наведенні.",
    component: PortfolioGallery,
  },
  timeline: {
    block: "timeline",
    label: "Досвід / шлях",
    description: "Хронологія досвіду чи процесу — період, етап, опис. Лише реальні дати й етапи.",
    component: PortfolioTimeline,
  },
  banner: {
    block: "cta",
    label: "Смуга-твердження",
    description:
      "Повноширинна смуга з великим гаслом/цитатою і підзаголовком, із неоновою підсвіткою — без кнопки.",
    component: PortfolioBanner,
  },
  testimonials: {
    block: "testimonials",
    label: "Відгуки",
    description: "Скляні картки відгуків — цитата, автор, роль.",
    component: PortfolioTestimonials,
  },
  lead_form: {
    block: "lead_form",
    label: "Форма заявки",
    description: "Форма збору заявок — надсилає лід власнику в Telegram.",
    component: PortfolioLeadForm,
  },
  contacts: {
    block: "contacts",
    label: "Контакти",
    description: "Контактні дані та кнопки месенджерів (дзвінок / Viber / Telegram).",
    component: PortfolioContacts,
  },
};

export const portfolioMeta: {
  id: "portfolio";
  label: string;
  description: string;
  verticalIds: string[];
  order: string[];
  wrapper: ComponentType<{ children: ReactNode }>;
} = {
  id: "portfolio",
  label: "«Portfolio — темний tech»",
  description:
    "Темний tech-стиль: майже-чорний фон, бірюзовий (teal) акцент і бурштинові деталі, скляні картки з неоновою підсвіткою (glow), Inter + курсивна Playfair — сучасний, технологічний, креативний, «продаж майстерності й кейсів».",
  verticalIds: ["generic"],
  order: [
    "hero",
    "marquee",
    "about",
    "gallery",
    "timeline",
    "banner",
    "testimonials",
    "lead_form",
    "contacts",
  ],
  wrapper: PortfolioWrapper,
};
