import type { ComponentType, ReactNode } from "react";
import type { TemplateBrand } from "@/lib/templates/registry";
import type { TemplateSectionDef } from "@/components/templates/studio";

import NextlyWrapper from "./NextlyWrapper";
import NextlyHero from "./NextlyHero";
import NextlyAbout from "./NextlyAbout";
import NextlySwitchback from "./NextlySwitchback";
import NextlyServices from "./NextlyServices";
import NextlyStats from "./NextlyStats";
import NextlyTimeline from "./NextlyTimeline";
import NextlyTestimonials from "./NextlyTestimonials";
import NextlyTeam from "./NextlyTeam";
import NextlyMarquee from "./NextlyMarquee";
import NextlyCTA from "./NextlyCTA";
import NextlyLeadForm from "./NextlyLeadForm";
import NextlyContacts from "./NextlyContacts";

/**
 * Nextly ("nextly") — a clean, indigo-accented marketing look (Inter, generous
 * whitespace, signature indigo icon-chip "benefit" rows, rounded gray cards)
 * ported from template_sources/nextly-template-main. Ships LIGHT (default) +
 * DARK themes via the wrapper's data-theme toggle. Startup-led: benefit rows →
 * social proof (stats/testimonials) → team → cta, with switchback (story rows),
 * timeline (journey) and marquee (keyword strip) in the same indigo language.
 * No gallery/faq.
 */
export const nextlySections: Record<string, TemplateSectionDef> = {
  hero: {
    block: "hero",
    label: "Головний екран",
    description:
      "Двоколонковий екран: індиго-eyebrow, великий заголовок, підзаголовок, дві кнопки; праворуч ілюстрація (imageUrl) або декоративна індиго-градієнтна панель.",
    component: NextlyHero,
  },
  about: {
    block: "richText",
    label: "Про нас",
    description: "Чистий текстовий блок «про нас»: заголовок і текст; рядки з «- » стають списком.",
    component: NextlyAbout,
  },
  switchback: {
    block: "switchback",
    label: "Історія (фото + текст)",
    navLabel: "Історія",
    description:
      "Почергові рядки «зигзаг»: велике округле фото поруч із текстом, ліворуч/праворуч по черзі; індиго-акцент і кнопка. Рядок без фото стає центрованим текстовим блоком.",
    component: NextlySwitchback,
  },
  services: {
    block: "services",
    label: "Послуги",
    description:
      "Фірмова nextly-сітка «переваг»: картки з індиго-чіпом-іконкою, назвою, описом і ціною.",
    component: NextlyServices,
  },
  stats: {
    block: "stats",
    label: "Показники",
    description: "Сітка показників великими індиго-цифрами (лише реальні дані).",
    component: NextlyStats,
  },
  timeline: {
    block: "timeline",
    label: "Хронологія",
    description:
      "Вертикальна лінія шляху бізнесу: індиго-вузол на кожен етап — період, назва, підзаголовок і опис (лише реальні дати).",
    component: NextlyTimeline,
  },
  testimonials: {
    block: "testimonials",
    label: "Відгуки",
    description: "Сірі округлі картки відгуків — цитата, аватар/ініціали, ім'я, роль.",
    component: NextlyTestimonials,
  },
  team: {
    block: "team",
    label: "Команда",
    description: "Картки команди — фото або індиго-ініціали, ім'я, роль, короткий опис.",
    component: NextlyTeam,
  },
  marquee: {
    block: "marquee",
    label: "Рядок переваг",
    description:
      "Плавний рухомий рядок коротких ключових слів (переваги / напрями) з індиго-крапками-роздільниками на світлому фоні.",
    component: NextlyMarquee,
  },
  cta: {
    block: "cta",
    label: "Заклик до дії",
    description: "Індиго-картка на всю ширину: заголовок, підзаголовок і біла кнопка.",
    component: NextlyCTA,
  },
  lead_form: {
    block: "lead_form",
    label: "Форма заявки",
    description: "Форма збору заявок — надсилає лід власнику в Telegram.",
    component: NextlyLeadForm,
  },
  contacts: {
    block: "contacts",
    label: "Контакти",
    description: "Контактні дані та кнопки месенджерів (дзвінок / Viber / Telegram).",
    component: NextlyContacts,
  },
};

export const nextlyMeta: {
  id: "nextly";
  label: string;
  description: string;
  verticalIds: string[];
  order: string[];
  wrapper: ComponentType<{ children: ReactNode; brand?: TemplateBrand }>;
} = {
  id: "nextly",
  label: "«Nextly — чистий індиго-маркетинг»",
  description:
    "Чистий, світлий (або темний) маркетинговий стиль: індиго-акцент, багато повітря, шрифт Inter, фірмові рядки «переваг» з індиго-іконками, округлі сірі картки — стриманий, професійний, «стартап/продукт/послуга», викликає довіру та легко читається.",
  verticalIds: ["generic"],
  order: [
    "hero",
    "about",
    "switchback",
    "services",
    "stats",
    "timeline",
    "testimonials",
    "team",
    "marquee",
    "cta",
    "lead_form",
    "contacts",
  ],
  wrapper: NextlyWrapper,
};
