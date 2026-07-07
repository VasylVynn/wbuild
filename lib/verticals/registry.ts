import type { VerticalConfig } from "./types";

/**
 * Vertical registry — a business type is DATA, not a code fork (Fable verdict).
 * Each config carries the domain-advisor knowledge (owner feedback): what to
 * suggest and which niche-specific questions to ask, so the agent guides an
 * owner who doesn't know what belongs on a site. Add a niche = add an entry.
 */

const baseFields: VerticalConfig["fields"] = {
  businessName: { label: "Назва бізнесу", fact: true, required: true },
  city: { label: "Місто", fact: true, required: true },
  phone: { label: "Телефон", fact: true, required: true },
  address: { label: "Адреса", fact: true },
  hours: { label: "Години роботи", fact: true },
  about: { label: "Про бізнес", fact: false },
  services: { label: "Послуги / ціни", fact: true },
  testimonials: { label: "Відгуки клієнтів", fact: true },
  socials: { label: "Соцмережі", fact: true },
};

export const verticals: Record<string, VerticalConfig> = {
  florist: {
    id: "florist",
    label: "Квіткарня",
    aliases: ["квіт", "букет", "флорист", "троянд", "піво"],
    personaHint: "власник квіткового магазину або студії флористики",
    genHint: "тепло й естетично; акценти на послугах, галереї робіт і відгуках",
    advisorGuidance:
      "Порадь вказати кілька послуг (напр. авторські букети, доставка квітів, весільна флористика, оформлення подій) з орієнтовними цінами, години роботи та спосіб замовлення (телефон/Instagram). Якщо клієнт не знає, що вказати — просто запропонуй типове для квіткарні й спитай, що з цього він робить.",
    fields: { ...baseFields, services: { label: "Послуги (напр. букети, доставка)", fact: true } },
    priceRange: { min: 50, max: 15000 },
    themePresetIds: ["rose-classic", "sage-minimal", "burgundy-elegant", "peach-soft"],
    exampleServices: ["Авторський букет", "Доставка квітів", "Весільна флористика", "Оформлення подій"],
  },
  bakery: {
    id: "bakery",
    label: "Пекарня / кондитерська",
    aliases: ["пекарн", "кондитер", "торт", "випічк", "хліб", "десерт", "солодощ"],
    personaHint: "власник пекарні або кондитерської",
    genHint: "затишно й апетитно; акценти на асортименті/меню з цінами та галереї",
    advisorGuidance:
      "Порадь вказати асортимент або меню з цінами (напр. торти на замовлення, тістечка, хліб), можливість замовлення тортів під подію, доставку та години роботи. Якщо не знає — запропонуй типове для пекарні й уточни, що саме він випікає.",
    fields: { ...baseFields, services: { label: "Меню / асортимент з цінами", fact: true } },
    priceRange: { min: 20, max: 5000 },
    themePresetIds: ["warm-bakery", "peach-soft", "rose-classic"],
    exampleServices: ["Торти на замовлення", "Тістечка", "Свіжий хліб", "Кава з собою"],
  },
  lawyer: {
    id: "lawyer",
    label: "Юрист / адвокат",
    aliases: ["юрист", "адвокат", "нотаріус", "правов", "юридичн"],
    personaHint: "юрист, адвокат або нотаріус",
    genHint: "стримано, професійно й надійно; акценти на напрямках послуг і як записатися",
    advisorGuidance:
      "Юристи різні — СПЕРШУ уточни спеціалізацію (сімейне, кримінальне, корпоративне право, нерухомість, нотаріальні послуги тощо), бо від цього залежить весь сайт. Порадь винести: напрямки послуг, орієнтовну вартість консультації, як записатися на консультацію, роки практики чи досвід. Веди просто, без канцеляриту.",
    fields: { ...baseFields, services: { label: "Напрямки послуг (з орієнтовними цінами)", fact: true } },
    priceRange: { min: 200, max: 100000 },
    themePresetIds: ["slate-professional", "navy-trust"],
    exampleServices: ["Консультація", "Складання договорів", "Супровід угод", "Представництво в суді"],
  },
  autoservice: {
    id: "autoservice",
    label: "Автосервіс / СТО",
    aliases: ["авто", "сто", "шиномонт", "ремонт авто", "діагностик", "автомийк", "автосервіс"],
    personaHint: "власник автосервісу, СТО або шиномонтажу",
    genHint: "енергійно, технічно й впевнено; акценти на переліку послуг і як записатися",
    advisorGuidance:
      "Порадь вказати перелік послуг (напр. діагностика, ремонт двигуна, шиномонтаж, заміна масла) з орієнтовними цінами, як записатися (подзвонити або лишити номер — передзвонимо), години роботи та адресу з орієнтиром. Якщо не знає — запропонуй типове для СТО й уточни, на чому він спеціалізується.",
    fields: { ...baseFields, services: { label: "Послуги (напр. діагностика, ремонт)", fact: true } },
    priceRange: { min: 100, max: 50000 },
    themePresetIds: ["bold-slate", "slate-professional"],
    exampleServices: ["Комп'ютерна діагностика", "Заміна масла", "Шиномонтаж", "Ремонт ходової"],
  },
  generic: {
    id: "generic",
    label: "Бізнес / послуги",
    aliases: [],
    personaHint: "власник малого бізнесу у сфері послуг або торгівлі",
    genHint: "чисто, дружньо й професійно; акценти на послугах/товарах і контактах",
    advisorGuidance:
      "СПЕРШУ з'ясуй, ЯКИЙ це бізнес і що він пропонує. Далі порадь вказати перелік послуг або товарів з орієнтовними цінами, контакти, години роботи та як замовити чи звернутися. Веди дуже просто, як консультант, що допомагає людині, яка не знає, що писати на сайті.",
    fields: baseFields,
    priceRange: { min: 20, max: 100000 },
    themePresetIds: ["emerald-fresh", "slate-professional", "navy-trust"],
    exampleServices: ["Основна послуга", "Додаткова послуга", "Консультація"],
  },
};

export const VERTICAL_IDS: string[] = Object.keys(verticals);

export function getVertical(id?: string | null): VerticalConfig {
  return (id && verticals[id]) || verticals.generic;
}

/** Keyword fallback classifier (the agent also returns its own guess). */
export function classifyVertical(text: string): string {
  const t = text.toLowerCase();
  for (const v of Object.values(verticals)) {
    if (v.id === "generic") continue;
    if (v.aliases.some((a) => t.includes(a))) return v.id;
  }
  return "generic";
}
