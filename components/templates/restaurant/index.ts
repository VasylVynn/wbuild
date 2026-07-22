import type { ComponentType, ReactNode } from "react";
import type { TemplateBrand } from "@/lib/templates/registry";
import type { TemplateSectionDef } from "@/components/templates/studio";

import RestaurantWrapper from "./RestaurantWrapper";
import RestaurantHero from "./RestaurantHero";
import RestaurantAbout from "./RestaurantAbout";
import RestaurantServices, { RestaurantServicesBoard } from "./RestaurantServices";
import RestaurantMarquee, { RestaurantMarqueeBand } from "./RestaurantMarquee";
import RestaurantSwitchback, { RestaurantSwitchbackStacked } from "./RestaurantSwitchback";
import RestaurantStats from "./RestaurantStats";
import RestaurantGallery from "./RestaurantGallery";
import RestaurantTeam from "./RestaurantTeam";
import RestaurantPublications, { RestaurantPublicationsCards } from "./RestaurantPublications";
import RestaurantTestimonials from "./RestaurantTestimonials";
import RestaurantFAQ from "./RestaurantFAQ";
import RestaurantCTA from "./RestaurantCTA";
import RestaurantLeadForm, { RestaurantLeadFormSplit } from "./RestaurantLeadForm";
import RestaurantContacts, { RestaurantContactsSidebar } from "./RestaurantContacts";

/**
 * Restaurant ("restaurant") — a warm hospitality look (Lora display serif + Inter
 * body, cream canvas, terracotta accent, gold prices, olive details) translated
 * into our stack from template_sources/restaurant-1.0.0 (FlyonUI, MIT). Single
 * light theme. Signature sections: a MENU (services as a restaurant dish list
 * with gold prices), the chef TEAM, and opening HOURS in contacts. The funnel is
 * the standard lead form (no date/time booking fields). Same block contract as
 * the other templates.
 */
export const restaurantSections: Record<string, TemplateSectionDef> = {
  hero: {
    block: "hero",
    label: "Головний екран",
    description:
      "Теплий вступ: серифний заголовок, підзаголовок-«since», теракотова кнопка; праворуч/унизу апетитне фото (imageUrl) або декоративна тепла панель.",
    component: RestaurantHero,
  },
  about: {
    block: "richText",
    label: "Про нас",
    description: "Історія закладу: серифний заголовок і текст; рядки з «- » стають списком.",
    component: RestaurantAbout,
  },
  services: {
    block: "services",
    label: "Меню",
    description:
      "Меню страв у стилі ресторанного переліку: назва серифом, опис, ЦІНА золотом; опційний бейдж (напр. «хіт»). Варіант board — меню як сітка карток-плиток замість переліку з крапками.",
    component: RestaurantServices,
    variants: { board: RestaurantServicesBoard },
  },
  marquee: {
    block: "marquee",
    label: "Стрічка смаків",
    description:
      "Тепла рухома стрічка коротких слів серифом — фірмові страви, інгредієнти чи цінності закладу, з крапками-роздільниками. Лише реальні поняття, від 3 пунктів. Варіант band — теракотова смуга.",
    component: RestaurantMarquee,
    variants: { band: RestaurantMarqueeBand },
  },
  switchback: {
    block: "switchback",
    label: "Історія у деталях",
    navLabel: "Історія",
    description:
      "Почергові рядки «фото + текст» (зиґзаґ): заголовок серифом, розповідь і опційне посилання-стрілка — про кухню, продукти, шлях «від ферми до столу». Фото беруться з props; без фото — тепла декоративна панель. Варіант stacked — компактні картки з фото зверху.",
    component: RestaurantSwitchback,
    variants: { stacked: RestaurantSwitchbackStacked },
  },
  stats: {
    block: "stats",
    label: "Показники",
    description: "Тепла смуга показників (роки, страви, гості) — лише реальні цифри.",
    component: RestaurantStats,
  },
  gallery: {
    block: "gallery",
    label: "Галерея страв",
    description: "Сітка апетитних фото з підписом (назва/категорія) на наведенні.",
    component: RestaurantGallery,
  },
  team: {
    block: "team",
    label: "Шеф-кухарі",
    description: "Картки команди/кухарів — фото або ініціали, ім'я, роль. Лише реальні люди.",
    component: RestaurantTeam,
  },
  testimonials: {
    block: "testimonials",
    label: "Відгуки",
    description: "Теплі картки відгуків гостей — цитата, аватар/ініціали, ім'я, роль.",
    component: RestaurantTestimonials,
  },
  publications: {
    block: "publications",
    label: "Про нас пишуть",
    navLabel: "Преса",
    description:
      "Згадки у пресі, відзнаки та нагороди: назва матеріалу/нагороди, підзаголовок, видання (source) і рік золотом. Лише реальні згадки, без вигадок. Варіант cards — сітка теплих карток.",
    component: RestaurantPublications,
    variants: { cards: RestaurantPublicationsCards },
  },
  faq: {
    block: "faq",
    label: "Питання та відповіді",
    navLabel: "Питання",
    description: "Акордеон питань/відповідей із теракотовим індикатором (одне відкрите).",
    component: RestaurantFAQ,
  },
  cta: {
    block: "cta",
    label: "Заклик до дії",
    description: "Тепла смуга-заклик (напр. «Замовляйте зараз»): заголовок, підзаголовок, кнопка.",
    component: RestaurantCTA,
  },
  lead_form: {
    block: "lead_form",
    label: "Форма заявки",
    description:
      "Форма збору заявок — надсилає лід власнику в Telegram. Варіант split — форма праворуч, теракотова decor-панель із заголовком ліворуч.",
    component: RestaurantLeadForm,
    variants: { split: RestaurantLeadFormSplit },
  },
  contacts: {
    block: "contacts",
    label: "Контакти",
    description:
      "Контактні дані з акцентом на ГОДИНИ РОБОТИ, адреса, телефон і кнопки месенджерів (дзвінок / Viber / Telegram). Варіант sidebar — довідка у дві колонки: перелік фактів ліворуч, сайдбар із годинами й кнопками праворуч.",
    component: RestaurantContacts,
    variants: { sidebar: RestaurantContactsSidebar },
  },
};

export const restaurantMeta: {
  id: "restaurant";
  label: string;
  description: string;
  verticalIds: string[];
  order: string[];
  wrapper: ComponentType<{ children: ReactNode; brand?: TemplateBrand }>;
} = {
  id: "restaurant",
  label: "«Restaurant — тепла гостинність»",
  description:
    "Теплий гостинний стиль для закладів харчування: вершкове тло, теракотовий акцент, золоті ціни, оливкові деталі, серифний Lora — апетитний, затишний, «ресторан/кафе/пекарня». Секція-меню, шеф-кухарі, години роботи. Одна світла тема.",
  verticalIds: ["generic"],
  order: [
    "hero",
    "about",
    "services",
    "marquee",
    "switchback",
    "stats",
    "gallery",
    "team",
    "testimonials",
    "publications",
    "faq",
    "cta",
    "lead_form",
    "contacts",
  ],
  wrapper: RestaurantWrapper,
};
