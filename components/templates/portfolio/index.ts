import type { ComponentType, ReactNode } from "react";
import type { TemplateSectionDef } from "@/lib/templates/registry";

import PortfolioWrapper from "./PortfolioWrapper";
import PortfolioHero from "./PortfolioHero";
import PortfolioMarquee from "./PortfolioMarquee";
import PortfolioAbout from "./PortfolioAbout";
import PortfolioSwitchback from "./PortfolioSwitchback";
import PortfolioGallery from "./PortfolioGallery";
import PortfolioPublications from "./PortfolioPublications";
import PortfolioTimeline from "./PortfolioTimeline";
import PortfolioTeam from "./PortfolioTeam";
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
    navLabel: "Навички",
    description: "Рухома стрічка коротких ключових слів (навички / технології / напрямки). Лише реальні.",
    component: PortfolioMarquee,
  },
  about: {
    block: "richText",
    label: "Про нас",
    description: "Заголовок і текст; рядки з «- » стають списком.",
    component: PortfolioAbout,
  },
  switchback: {
    block: "switchback",
    label: "Історія у деталях",
    navLabel: "Історія",
    description:
      "Чергування фото + текст «зиґзаґом»: широкі ряди, у яких зображення міняє бік, а поруч — serif-заголовок, короткий текст і опційне посилання-стрілка. Без фото ряд стає центрованим текстом.",
    component: PortfolioSwitchback,
  },
  gallery: {
    block: "gallery",
    label: "Роботи",
    description: "Сітка проєктів/робіт із підписом (назва/категорія) на наведенні.",
    component: PortfolioGallery,
  },
  publications: {
    block: "publications",
    label: "Праці та згадки",
    navLabel: "Праці",
    description:
      "Індекс робіт / публікацій / кейсів: рядки з порядковим номером, назвою (serif), підзаголовком і роком + джерелом праворуч. Тонкі лінії-роздільники, без фото. Лише реальні праці.",
    component: PortfolioPublications,
  },
  timeline: {
    block: "timeline",
    label: "Досвід / шлях",
    description: "Хронологія досвіду чи процесу — період, етап, опис. Лише реальні дати й етапи.",
    component: PortfolioTimeline,
  },
  team: {
    block: "team",
    label: "Команда",
    description:
      "Реальні люди бізнесу: центровані скляні картки з круглим портретом (або монограмою у teal-кружку без фото), serif-імʼям, роллю (teal) та коротким описом.",
    component: PortfolioTeam,
  },
  banner: {
    block: "cta",
    label: "Смуга-твердження",
    navLabel: "Гасло",
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
    "switchback",
    "gallery",
    "publications",
    "timeline",
    "team",
    "banner",
    "testimonials",
    "lead_form",
    "contacts",
  ],
  wrapper: PortfolioWrapper,
};
