import type { ComponentType, ReactNode } from "react";
import type { BlockType } from "@/lib/blocks/schema";

import StudioWrapper from "./StudioWrapper";
import HeroSection from "./HeroSection";
import FeaturesSection from "./FeaturesSection";
import HowItWorksSection from "./HowItWorksSection";
import PricingSection from "./PricingSection";
import AboutSection from "./AboutSection";
import StatsSection from "./StatsSection";
import FAQSection from "./FAQSection";
import CTASection from "./CTASection";
import LeadFormSection from "./LeadFormSection";
import ContactsSection from "./ContactsSection";

/**
 * A single section of the studio template.
 *  - `block`     — which of our block schemas feeds it (many sections may share
 *                  one block, e.g. features/howitworks/pricing all read `services`).
 *  - `label`     — Ukrainian name, for the editor/registry.
 *  - `description` — one Ukrainian line, guidance for the generation model.
 *  - `component` — renders the section from `{ data }` (already-validated block
 *                  props, passed as `unknown`) plus an optional `extra` (only
 *                  the hero uses it: the stat-row items).
 */
export interface TemplateSectionDef {
  block: BlockType;
  label: string;
  description: string;
  component: ComponentType<{ data: unknown; extra?: unknown }>;
}

export const studioSections: Record<string, TemplateSectionDef> = {
  hero: {
    block: "hero",
    label: "Головний екран",
    description:
      "Великий заголовок на темному тлі з градієнтними плямами, підзаголовок і до двох кнопок дії; опційний ряд показників.",
    component: HeroSection,
  },
  features: {
    block: "services",
    label: "Переваги",
    description: "Сітка карток з іконками — ключові переваги чи послуги, без цін.",
    component: FeaturesSection,
  },
  howitworks: {
    block: "services",
    label: "Як це працює",
    description: "Пронумеровані кроки процесу (01, 02, 03…); ціни ігноруються.",
    component: HowItWorksSection,
  },
  pricing: {
    block: "services",
    label: "Тарифи",
    description:
      "Картки з цінами; бейдж виділяє популярний тариф; рядки опису (через \\n) стають чеклістом.",
    component: PricingSection,
  },
  about: {
    block: "richText",
    label: "Про нас",
    description:
      "Заголовок і текст історії; рядки, що починаються з «- », стають списком принципів поруч.",
    component: AboutSection,
  },
  stats: {
    block: "stats",
    label: "Показники",
    description: "Смуга з числовими показниками та підписами (лише реальні цифри).",
    component: StatsSection,
  },
  faq: {
    block: "faq",
    label: "Питання та відповіді",
    description: "Акордеон із одним відкритим елементом і плавною анімацією.",
    component: FAQSection,
  },
  cta: {
    block: "cta",
    label: "Заклик до дії",
    description: "Фінальний блок із заголовком, підзаголовком і кнопкою дії.",
    component: CTASection,
  },
  lead_form: {
    block: "lead_form",
    label: "Форма заявки",
    description: "Форма збору заявок — надсилає лід власнику в Telegram.",
    component: LeadFormSection,
  },
  contacts: {
    block: "contacts",
    label: "Контакти",
    description: "Контактні дані та кнопки месенджерів (дзвінок / Viber / Telegram).",
    component: ContactsSection,
  },
};

export const studioMeta: {
  id: "studio";
  label: string;
  description: string;
  verticalIds: string[];
  order: string[];
  wrapper: ComponentType<{ children: ReactNode }>;
} = {
  id: "studio",
  label: "«Студія — темний преміум»",
  description:
    "Темний преміальний одноекранник із фіолетовими акцентами, тонкими анімаціями та мінімалістичними картками — для послуг, що продають експертність (юристи, автосервіс, студії).",
  verticalIds: ["generic", "lawyer", "autoservice"],
  order: [
    "hero",
    "features",
    "howitworks",
    "pricing",
    "about",
    "stats",
    "faq",
    "cta",
    "lead_form",
    "contacts",
  ],
  wrapper: StudioWrapper,
};
