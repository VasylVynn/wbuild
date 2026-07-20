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
import FerriTimeline from "./FerriTimeline";
import FerriTeam from "./FerriTeam";
import FerriTeamAlt from "./FerriTeamAlt";
import FerriMarquee from "./FerriMarquee";
import FerriPrinciples from "./FerriPrinciples";
import FerriStats from "./FerriStats";
import FerriSwitchback from "./FerriSwitchback";

/**
 * Ferri — an elegant dark-navy + gold, serif (Cormorant) editorial look ported
 * from template_sources/ferri-schoedl-main. Ships BOTH a dark (default) and a
 * light theme; the wrapper owns the toggle. A restrained composition: a mission
 * BANNER and a spare stats band carry proof — testimonials/faq/cta noise stays
 * out, status over volume.
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
  principles: {
    block: "richText",
    label: "Підхід",
    description:
      "Двоколонковий блок принципів/цінностей: ліворуч золотий мікрозаголовок, серифний заголовок і золота лінія (липнуть при прокрутці), праворуч абзаци або список принципів (рядки з «- »). Про те, ЯК ми працюємо — відмінний від «Про нас» (розповідь).",
    component: FerriPrinciples,
  },
  timeline: {
    block: "timeline",
    label: "Шлях",
    description:
      "Вертикальна хронологія досвіду/розвитку: рік або період, назва етапу, підзаголовок і опис — з’єднані золотою лінією з вузлами. Лише реальні дати й події, без вигаданих.",
    component: FerriTimeline,
  },
  stats: {
    block: "stats",
    label: "Цифри",
    description:
      "Смуга ключових чисел: велике золоте значення з табличними цифрами над стриманим підписом (роки на ринку, кількість клієнтів, середня оцінка). Лише реальні цифри — нічого не вигадувати.",
    component: FerriStats,
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
  story: {
    block: "switchback",
    label: "Історія",
    description:
      "Чергування фото + текст (зигзаг): великий кадр у золотій рамці й колонка прози міняються боками щорядка — про майстерню, процес чи кейси. §4.8: рядок без фото стає центрованою текстовою карткою. Опційна кнопка-посилання під текстом.",
    component: FerriSwitchback,
  },
  team: {
    block: "team",
    label: "Команда",
    description:
      "Реальні люди бізнесу (партнери, майстри, експерти): фото або монограма з ініціалів, ім’я, роль і короткий опис. Центровані картки; варіант «list» — стриманий список-реєстр. Лише справжні особи.",
    component: FerriTeam,
    variants: { list: FerriTeamAlt },
  },
  publications: {
    block: "publications",
    label: "Праці",
    description: "Бібліографія праць/книг/статей — назва, рік, джерело. Лише реальні.",
    component: FerriPublications,
  },
  marquee: {
    block: "marquee",
    label: "Стрічка",
    description:
      "Рухома горизонтальна стрічка коротких ключових слів (напрямки, цінності, переваги) серифом із золотими ромбами-розділювачами. Мінімум 3 слова, лише реальні.",
    component: FerriMarquee,
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
    "principles",
    "timeline",
    "stats",
    "banner",
    "services",
    "story",
    "team",
    "publications",
    "marquee",
    "gallery",
    "lead_form",
    "contacts",
  ],
  wrapper: FerriWrapper,
};
