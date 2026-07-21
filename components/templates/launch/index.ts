import type { ComponentType, ReactNode } from "react";
import type { TemplateBrand } from "@/lib/templates/registry";
import type { TemplateSectionDef } from "@/components/templates/studio";

import LaunchWrapper from "./LaunchWrapper";
import LaunchHero, { LaunchHeroSplit } from "./LaunchHero";
import LaunchServices, { LaunchServicesList } from "./LaunchServices";
import LaunchSwitchback from "./LaunchSwitchback";
import LaunchStats from "./LaunchStats";
import LaunchGallery from "./LaunchGallery";
import LaunchTestimonials, { LaunchTestimonialsSpotlight } from "./LaunchTestimonials";
import LaunchMarquee from "./LaunchMarquee";
import LaunchFAQ, { LaunchFAQGrid } from "./LaunchFAQ";
import LaunchCTA from "./LaunchCTA";
import LaunchLeadForm from "./LaunchLeadForm";
import LaunchContacts from "./LaunchContacts";

/**
 * Launch ("launch" / «Лонч») — a faithful port of the Launch UI kit
 * (template_sources/launch-ui-main, MIT), adapted from a SaaS marketing site to
 * a LOCAL-BUSINESS one-pager. Its identity: a warm-orange brand, a radial GLOW
 * behind hero/CTA, gradient headline text, glass surfaces and a soft "appear"
 * reveal — bold and modern. Ships DARK (default) + LIGHT (LaunchWrapper owns the
 * theme; visitor toggle). Manrope display + Inter body (both Cyrillic). Same
 * block contract as the other templates.
 */
export const launchSections: Record<string, TemplateSectionDef> = {
  hero: {
    block: "hero",
    label: "Головний екран",
    description:
      "Сміливий вступ: короткий eyebrow-бейдж, великий градієнтний заголовок (+titleAccent іншим кольором) над сяйвом (glow), підзаголовок і дві кнопки. Праворуч/нижче — фото (imageUrl) у скляній рамці або декоративна панель зі сяйвом. Варіант split — текст ліворуч, медіа праворуч.",
    component: LaunchHero,
    variants: { split: LaunchHeroSplit },
  },
  services: {
    block: "services",
    label: "Послуги",
    description:
      "Сітка скляних карток послуг: іконка (або фото imageUrl) + назва, бейдж, опис і ціна помаранчевим. Варіант list — прайс-список: назва й опис ліворуч, ціна праворуч.",
    component: LaunchServices,
    variants: { list: LaunchServicesList },
  },
  switchback: {
    block: "switchback",
    label: "Як це працює",
    navLabel: "Як це працює",
    description:
      "Почергові рядки «фото + текст» (зиґзаґ): заголовок, розповідь і опційне посилання-стрілка — процес, підхід, переваги. Фото беруться з props; без фото — скляна панель зі сяйвом.",
    component: LaunchSwitchback,
  },
  stats: {
    block: "stats",
    label: "Показники",
    description: "Смуга великих градієнтних цифр із підписами (роки, клієнти, проєкти) — лише реальні числа, не вигадувати.",
    component: LaunchStats,
  },
  gallery: {
    block: "gallery",
    label: "Галерея",
    description: "Сітка реальних фото робіт/місця; підпис (назва/категорія) зʼявляється на наведенні.",
    component: LaunchGallery,
  },
  testimonials: {
    block: "testimonials",
    label: "Відгуки",
    description:
      "Скляні картки відгуків — цитата, ініціали, імʼя, роль. Лише справжні слова клієнтів. Варіант spotlight — великі центровані цитати над сяйвом.",
    component: LaunchTestimonials,
    variants: { spotlight: LaunchTestimonialsSpotlight },
  },
  marquee: {
    block: "marquee",
    label: "Стрічка",
    description:
      "Рухома стрічка коротких ключових слів із помаранчевими крапками-роздільниками — напрями, цінності, переваги. Лише реальні поняття, від 3 пунктів.",
    component: LaunchMarquee,
  },
  faq: {
    block: "faq",
    label: "Питання та відповіді",
    navLabel: "Питання",
    description:
      "Акордеон питань/відповідей (розкривається без JS, перше відкрите). Варіант grid — дві колонки карток для коротших Q/A.",
    component: LaunchFAQ,
    variants: { grid: LaunchFAQGrid },
  },
  cta: {
    block: "cta",
    label: "Заклик до дії",
    description: "Центрована скляна смуга-заклик над сяйвом: заголовок, підзаголовок і кнопка (зазвичай до #lead_form).",
    component: LaunchCTA,
  },
  lead_form: {
    block: "lead_form",
    label: "Форма заявки",
    description: "Форма збору заявок у скляній картці — надсилає лід власнику в Telegram.",
    component: LaunchLeadForm,
  },
  contacts: {
    block: "contacts",
    label: "Контакти",
    description:
      "Контактні дані (телефон, адреса, графік, email) у скляній картці та кнопки месенджерів (дзвінок / Viber / Telegram / Instagram) — лише за наявності.",
    component: LaunchContacts,
  },
};

export const launchMeta: {
  id: "launch";
  label: string;
  description: string;
  verticalIds: string[];
  order: string[];
  wrapper: ComponentType<{ children: ReactNode; brand?: TemplateBrand }>;
} = {
  id: "launch",
  label: "«Лонч» — сміливий сучасний глоу",
  description:
    "Сміливий сучасний стартап-стиль: помаранчевий бренд, радіальне сяйво (glow), градієнтні заголовки, скляні поверхні та мʼяка поява. Темна тема за замовчуванням + світла, перемикач для відвідувача. Універсальний для будь-якого локального бізнесу, що хоче виглядати сучасно.",
  verticalIds: ["generic"],
  order: [
    "hero",
    "services",
    "switchback",
    "stats",
    "gallery",
    "testimonials",
    "marquee",
    "faq",
    "cta",
    "lead_form",
    "contacts",
  ],
  wrapper: LaunchWrapper,
};
