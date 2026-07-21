import type { ComponentType, ReactNode } from "react";
import type { TemplateBrand } from "@/lib/templates/registry";
import type { TemplateSectionDef } from "@/lib/templates/registry";

import BelezaWrapper from "./BelezaWrapper";
import BelezaHero, { BelezaHeroSplit, BelezaHeroCenter } from "./BelezaHero";
import BelezaServices, { BelezaServicesList, BelezaServicesRows } from "./BelezaServices";
import BelezaSwitchback, { BelezaSwitchbackCards } from "./BelezaSwitchback";
import BelezaTimeline from "./BelezaTimeline";
import BelezaGallery, { BelezaGalleryMasonry } from "./BelezaGallery";
import BelezaTeam, { BelezaTeamRows } from "./BelezaTeam";
import BelezaTestimonials, { BelezaTestimonialsGrid, BelezaTestimonialsRail } from "./BelezaTestimonials";
import BelezaFAQ, { BelezaFAQBoxed } from "./BelezaFAQ";
import BelezaCTA, { BelezaCTASplit } from "./BelezaCTA";
import BelezaLeadForm, { BelezaLeadFormInline } from "./BelezaLeadForm";
import BelezaContacts, { BelezaContactsBand } from "./BelezaContacts";

/**
 * Beleza ("beleza") — «Белеза», a soft beauty-aesthetic look, our SECOND beauty
 * template. Ported from template_sources/espaco-embelezar-main (a Portuguese
 * beauty-space site) into our stack: a warm off-white canvas, a deep rose/mauve
 * accent and a pale-rose tint, fully ROUNDED typography (Comfortaa display +
 * Nunito body — Cyrillic substitutes for the source's OpenRunde), soft rounded
 * cards and the signature dashed-rose section headers. It deliberately differs
 * from the salon template (serif-led glass luxe): beleza is calm, rounded and
 * minimal, with a price-list-led menu and a vertical "як проходить візит" rail.
 * Single LIGHT theme. Same block contract as the other templates.
 */
export const belezaSections: Record<string, TemplateSectionDef> = {
  hero: {
    block: "hero",
    label: "Головний екран",
    description:
      "Мʼякий вступ: рожевий бейдж, великий округлий заголовок (+опційний акцентний хвіст titleAccent), підзаголовок, рожева кнопка + світла друга кнопка, ряд переваг; праворуч фото (imageUrl) або декоративна рожева панель. Варіанти: split — фото ліворуч на рожевій смузі; center — центрований блок із широким фото знизу.",
    component: BelezaHero,
    variants: { split: BelezaHeroSplit, center: BelezaHeroCenter },
  },
  services: {
    block: "services",
    label: "Послуги",
    description:
      "Прайс-лист послуг (ключове для бʼюті): назва, опис, ЦІНА рожевим, опційна іконка та бейдж. Типово — сітка мʼяких карток; варіант list — друкований прайс із крапками-лідерами; варіант rows — компактні рядки з іконкою.",
    component: BelezaServices,
    variants: { list: BelezaServicesList, rows: BelezaServicesRows },
  },
  switchback: {
    block: "switchback",
    label: "Історія простору",
    navLabel: "Історія",
    description:
      "Почергові рядки «фото + текст» (зиґзаґ) — про простір, підхід, трансформації «до/після»: округлий заголовок, розповідь і опційне посилання-стрілка. Фото лише з props; без фото — мʼяка рожева панель. Варіант cards — історії як мʼякі картки в сітці.",
    component: BelezaSwitchback,
    variants: { cards: BelezaSwitchbackCards },
  },
  timeline: {
    block: "timeline",
    label: "Як проходить візит",
    navLabel: "Візит",
    description:
      "«Як проходить візит» — вертикальна ліва шкала з рожевими крапками й нумерацією (01, 02…): етап, короткий підзаголовок і опис. Спокійна одноколонкова доріжка на рожевому тлі.",
    component: BelezaTimeline,
  },
  gallery: {
    block: "gallery",
    label: "Галерея",
    description:
      "Реальні роботи простору (фото лише з props) із мʼяким підписом (назва/категорія) на наведенні. Типово — рівна сітка; варіант masonry — мозаїка різної висоти.",
    component: BelezaGallery,
    variants: { masonry: BelezaGalleryMasonry },
  },
  team: {
    block: "team",
    label: "Майстрині",
    description:
      "Картки майстринь простору — фото або рожевий медальйон з ініціалами, імʼя, роль, короткий опис. Лише реальні люди. Варіант rows — горизонтальні картки (фото ліворуч, текст праворуч), просторіше для довших описів.",
    component: BelezaTeam,
    variants: { rows: BelezaTeamRows },
  },
  testimonials: {
    block: "testimonials",
    label: "Відгуки",
    description:
      "Реальні відгуки клієнток — цитата, аватар з ініціалами, імʼя, роль. Типово — картки з рядком зірок; варіант grid — редакційна дві-колонка з великою рожевою лапкою; варіант rail — «стрічка цитат»: один стовпчик, нумерація 01, 02… і пунктирно-рожеві розділювачі.",
    component: BelezaTestimonials,
    variants: { grid: BelezaTestimonialsGrid, rail: BelezaTestimonialsRail },
  },
  faq: {
    block: "faq",
    label: "Питання та відповіді",
    navLabel: "Питання",
    description:
      "Акордеон питань/відповідей (нативний, працює без JS; перше відкрите) з рожевим шевроном. Типово — розділений список; варіант boxed — кожне питання окремою карткою.",
    component: BelezaFAQ,
    variants: { boxed: BelezaFAQBoxed },
  },
  cta: {
    block: "cta",
    label: "Заклик до дії",
    description:
      "Мʼяка рожева смуга-заклик (напр. «Запишіться на візит»): округлий заголовок, підзаголовок, світла кнопка. Варіант split — текст ліворуч, кнопка праворуч.",
    component: BelezaCTA,
    variants: { split: BelezaCTASplit },
  },
  lead_form: {
    block: "lead_form",
    label: "Форма заявки",
    description:
      "Форма збору заявок — надсилає лід власнику в Telegram. Ліворуч — переконливі пункти, праворуч — картка з полями. Варіант inline — центрована рожева смуга з полями в один рядок (імʼя · телефон · кнопка).",
    component: BelezaLeadForm,
    variants: { inline: BelezaLeadFormInline },
  },
  contacts: {
    block: "contacts",
    label: "Контакти",
    description:
      "Контактні дані з акцентом на ГОДИНАХ РОБОТИ (окремий блок), адреса, телефон, email і кнопки месенджерів (дзвінок / Viber / Telegram). Варіант band — повноширинна рожева смуга у три колонки: графік+заголовок, контакти списком, кнопки окремим стовпчиком.",
    component: BelezaContacts,
    variants: { band: BelezaContactsBand },
  },
};

export const belezaMeta: {
  id: "beleza";
  label: string;
  description: string;
  verticalIds: string[];
  order: string[];
  wrapper: ComponentType<{ children: ReactNode; brand?: TemplateBrand }>;
} = {
  id: "beleza",
  label: "«Белеза» — ніжна бʼюті-естетика",
  description:
    "Ніжна бʼюті-естетика: тепле майже-біле тло, глибокий рожево-мауве акцент і пастельно-рожевий відтінок, повністю округла типографіка, мʼякі картки та фірмові пунктирно-рожеві заголовки. Спокійний, округлий, мінімалістичний — прайс-лист послуг, майстрині, доріжка «як проходить візит». Друга бʼюті-тема поряд із LUXE-салоном, але зовсім інша за характером. Одна світла тема.",
  verticalIds: ["generic"],
  order: [
    "hero",
    "services",
    "switchback",
    "timeline",
    "gallery",
    "team",
    "testimonials",
    "faq",
    "cta",
    "lead_form",
    "contacts",
  ],
  wrapper: BelezaWrapper,
};
