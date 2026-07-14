import type { ComponentType, ReactNode } from "react";
import type { TemplateSectionDef } from "@/lib/templates/registry";

import SalonWrapper from "./SalonWrapper";
import SalonHero from "./SalonHero";
import SalonServices from "./SalonServices";
import SalonProcess from "./SalonProcess";
import SalonGallery from "./SalonGallery";
import SalonTeam from "./SalonTeam";
import SalonTestimonials from "./SalonTestimonials";
import SalonFAQ from "./SalonFAQ";
import SalonLeadForm from "./SalonLeadForm";
import SalonContacts from "./SalonContacts";
import SalonHeroAlt from "./SalonHeroAlt";
import SalonHeroAlt2 from "./SalonHeroAlt2";
import SalonServicesAlt from "./SalonServicesAlt";
import SalonGalleryAlt from "./SalonGalleryAlt";
import SalonTestimonialsAlt from "./SalonTestimonialsAlt";

/**
 * Salon ("luxe-salon") — a LIGHT luxury look (soft rounded glass cards, gold +
 * beauty-pink/purple accents, Playfair display serif) ported from
 * template_sources/salon-website-main. Ships light (default) + dark themes; the
 * wrapper owns the toggle. Service-menu led, with a "your visit" PROCESS flow.
 */
export const salonSections: Record<string, TemplateSectionDef> = {
  hero: {
    block: "hero",
    label: "Головний екран",
    description:
      "Повноекранний вступ: великий градієнтний заголовок, скляний бейдж, підзаголовок, дві кнопки й фонові ефекти.",
    component: SalonHero,
    variants: { split: SalonHeroAlt, editorial: SalonHeroAlt2 },
  },
  services: {
    block: "services",
    label: "Послуги",
    description: "Сітка карток послуг з іконками — назва, опис, ціна.",
    component: SalonServices,
    variants: { rows: SalonServicesAlt },
  },
  process: {
    block: "timeline",
    label: "Як відбувається візит",
    description:
      "Пронумеровані кроки візиту (01, 02, 03…) — від запису до результату; етап, короткий опис.",
    component: SalonProcess,
  },
  gallery: {
    block: "gallery",
    label: "Галерея",
    description: "Мозаїка робіт із підписами (назва/категорія) на наведенні.",
    component: SalonGallery,
    variants: { grid: SalonGalleryAlt },
  },
  team: {
    block: "team",
    label: "Команда",
    description: "Майстри салону — фото або ініціали, ім'я, роль. Лише реальні люди.",
    component: SalonTeam,
  },
  testimonials: {
    block: "testimonials",
    label: "Відгуки",
    description: "Карусель відгуків клієнтів — цитата, автор, роль.",
    component: SalonTestimonials,
    variants: { grid: SalonTestimonialsAlt },
  },
  faq: {
    block: "faq",
    label: "Питання та відповіді",
    description: "Акордеон із питаннями та відповідями (одне відкрите).",
    component: SalonFAQ,
  },
  lead_form: {
    block: "lead_form",
    label: "Форма заявки",
    description: "Форма збору заявок — надсилає лід власнику в Telegram.",
    component: SalonLeadForm,
  },
  contacts: {
    block: "contacts",
    label: "Контакти",
    description: "Контактні дані та кнопки месенджерів (дзвінок / Viber / Telegram).",
    component: SalonContacts,
  },
};

export const salonMeta: {
  id: "salon";
  label: string;
  description: string;
  verticalIds: string[];
  order: string[];
  wrapper: ComponentType<{ children: ReactNode }>;
} = {
  id: "salon",
  label: "«LUXE — світлий салон»",
  description:
    "Світлий luxury: майже-білий фон, м'які округлі форми, скляні картки, золоті та рожево-фіолетові градієнти, антиква Playfair — тепло, естетика, турбота, преміальність. Має дві теми: світлу (типова) і темну.",
  verticalIds: ["generic"],
  order: [
    "hero",
    "services",
    "process",
    "gallery",
    "team",
    "testimonials",
    "faq",
    "lead_form",
    "contacts",
  ],
  wrapper: SalonWrapper,
};
