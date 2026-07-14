import type { ComponentType, ReactNode } from "react";
import type { TemplateSectionDef } from "@/lib/templates/registry";

import FerriWrapper from "./FerriWrapper";
import FerriHero from "./FerriHero";
import FerriAbout from "./FerriAbout";
import FerriBanner from "./FerriBanner";
import FerriServices from "./FerriServices";
import FerriPublications from "./FerriPublications";
import FerriGallery from "./FerriGallery";
import FerriLeadForm from "./FerriLeadForm";
import FerriContacts from "./FerriContacts";
import FerriHeroAlt from "./FerriHeroAlt";
import FerriHeroAlt2 from "./FerriHeroAlt2";
import FerriServicesAlt from "./FerriServicesAlt";
import FerriAboutAlt from "./FerriAboutAlt";
import FerriGalleryAlt from "./FerriGalleryAlt";

/**
 * Ferri — an elegant dark-navy + gold, serif (Cormorant) editorial look ported
 * from template_sources/ferri-schoedl-main. Ships BOTH a dark (default) and a
 * light theme; the wrapper owns the toggle. A restrained, minimal composition:
 * a mission BANNER instead of stats/testimonials/faq/cta — status over noise.
 */
export const ferriSections: Record<string, TemplateSectionDef> = {
  hero: {
    block: "hero",
    label: "Головний екран",
    description:
      "Екран-обкладинка: великий серифний заголовок із золотим курсивним акцентом (titleAccent), підзаголовок, до двох кнопок і опційне вертикальне фото.",
    component: FerriHero,
    variants: { centered: FerriHeroAlt, image: FerriHeroAlt2 },
  },
  about: {
    block: "richText",
    label: "Про нас",
    description:
      "Блок «про нас»: золотий мікрозаголовок, серифний заголовок, золота лінія і текст історії; рядки з «- » стають списком.",
    component: FerriAbout,
    variants: { statement: FerriAboutAlt },
  },
  banner: {
    block: "cta",
    label: "Смуга-твердження",
    description:
      "Повноширинна смуга з великим серифним гаслом/цитатою і підзаголовком — без кнопки, розриває ритм сторінки.",
    component: FerriBanner,
  },
  services: {
    block: "services",
    label: "Напрямки",
    description: "Сітка карток напрямків/послуг з іконками — назва, опис, опційна ціна.",
    component: FerriServices,
    variants: { numbered: FerriServicesAlt },
  },
  publications: {
    block: "publications",
    label: "Праці",
    description: "Бібліографія праць/книг/статей — назва, рік, джерело. Лише реальні.",
    component: FerriPublications,
  },
  gallery: {
    block: "gallery",
    label: "Галерея",
    description: "Сітка зображень із підписом (назва/категорія на наведенні).",
    component: FerriGallery,
    variants: { featured: FerriGalleryAlt },
  },
  lead_form: {
    block: "lead_form",
    label: "Форма заявки",
    description: "Форма збору заявок — надсилає лід власнику в Telegram.",
    component: FerriLeadForm,
  },
  contacts: {
    block: "contacts",
    label: "Контакти",
    description: "Контактні дані та кнопки месенджерів (дзвінок / Viber / Telegram).",
    component: FerriContacts,
  },
};

export const ferriMeta: {
  id: "ferri";
  label: string;
  description: string;
  verticalIds: string[];
  order: string[];
  wrapper: ComponentType<{ children: ReactNode }>;
} = {
  id: "ferri",
  label: "«Ferri — класична антиква»",
  description:
    "Темна класика: глибокий navy, золоті акценти, класична антиква (serif), тонкі лінії й багато повітря — статус, довіра, вишуканість. Має дві теми: темну (типова) і світлу.",
  verticalIds: ["lawyer", "generic"],
  order: [
    "hero",
    "about",
    "banner",
    "services",
    "publications",
    "gallery",
    "lead_form",
    "contacts",
  ],
  wrapper: FerriWrapper,
};
