import type { VerticalConfig } from "./types";

/**
 * Vertical registry — a business type is DATA, not a code fork (Fable verdict).
 * Each config carries the domain-advisor knowledge (owner feedback): what a
 * site in this niche usually offers, so the agent can INFER and propose
 * instead of interrogating (W0 generate-first — advisorGuidance must never
 * order the model to ask; the prompt owns the ≤1–2-questions budget).
 * Add a niche = add an entry.
 */

/**
 * Shared safety suffix for every hero-image prompt (§4.8): the generated image
 * must read as atmosphere, never as a photo of the owner's real venue/products.
 * Appended to every variant so the honesty bounds can't be forgotten per-vertical.
 */
export const HERO_PROMPT_SUFFIX =
  "soft atmospheric background photograph, shallow depth of field, no people, " +
  "no readable text, no logos, no prices, no storefront or interior that could be " +
  "mistaken for a specific real venue, muted colors, suitable as a website hero background";

/** Compose a full hero prompt from an atmospheric subject + the shared suffix. */
const heroPrompt = (subject: string) => `${subject}, ${HERO_PROMPT_SUFFIX}`;

const baseFields: VerticalConfig["fields"] = {
  businessName: { label: "Назва бізнесу", fact: true, required: true },
  city: { label: "Місто", fact: true, required: true },
  phone: { label: "Телефон", fact: true, required: true },
  address: { label: "Адреса", fact: true },
  hours: { label: "Години роботи", fact: true },
  viber: { label: "Viber (номер, якщо є)", fact: true },
  telegram: { label: "Telegram (нік або номер, якщо є)", fact: true },
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
      "Типове для квіткарні: авторські букети, доставка квітів, весільна флористика, оформлення подій; замовлення телефоном або в Instagram. Власник не назвав послуг — запропонуй ці як основу і виводь решту з фото й постів; ціни та години додавай лише якщо відомі.",
    fields: { ...baseFields, services: { label: "Послуги (напр. букети, доставка)", fact: true } },
    priceRange: { min: 50, max: 15000 },
    exampleServices: ["Авторський букет", "Доставка квітів", "Весільна флористика", "Оформлення подій"],
    imagePrompts: [
      heroPrompt("extreme macro of soft rose and peony petals with dewy bokeh, delicate pastel botanicals"),
      heroPrompt("blurred abstract garden of out-of-focus wildflowers and greenery in gentle morning light"),
    ],
    // Petal pinks/magentas, or the stem-and-leaf greens they sit against.
    hueRanges: [
      { from: 320, to: 360 },
      { from: 90, to: 150 },
    ],
  },
  bakery: {
    id: "bakery",
    label: "Пекарня / кондитерська",
    aliases: ["пекарн", "кондитер", "торт", "випічк", "хліб", "десерт", "солодощ"],
    personaHint: "власник пекарні або кондитерської",
    genHint: "затишно й апетитно; акценти на асортименті/меню з цінами та галереї",
    advisorGuidance:
      "Типове для пекарні: торти на замовлення, тістечка, свіжий хліб, кава з собою; замовлення тортів під подію, доставка. Асортимент виводь з фото, постів і розмови; ціни й години — лише якщо відомі, без них сайт теж повноцінний.",
    fields: { ...baseFields, services: { label: "Меню / асортимент з цінами", fact: true } },
    priceRange: { min: 20, max: 5000 },
    exampleServices: ["Торти на замовлення", "Тістечка", "Свіжий хліб", "Кава з собою"],
    imagePrompts: [
      heroPrompt("warm flour-dust light drifting over rustic wheat stalks and golden grain textures"),
      heroPrompt("soft out-of-focus glow over linen and baked-dough textures in cozy warm morning tones"),
    ],
    // Crust, grain, caramel, butter — the warm end, nothing cold.
    hueRanges: [{ from: 20, to: 70 }],
  },
  lawyer: {
    id: "lawyer",
    label: "Юрист / адвокат",
    aliases: ["юрист", "адвокат", "нотаріус", "правов", "юридичн"],
    personaHint: "юрист, адвокат або нотаріус",
    genHint: "стримано, професійно й надійно; акценти на напрямках послуг і як записатися",
    advisorGuidance:
      "Спеціалізація (сімейне, кримінальне, корпоративне право, нерухомість, нотаріальні послуги) визначає весь сайт — виводь її з наявних даних; якщо її ніяк не видно, це найкращий кандидат на твоє одне уточнювальне питання. На сайт варто винести: напрямки послуг, як записатися на консультацію, роки практики чи досвід. Пиши просто, без канцеляриту.",
    fields: { ...baseFields, services: { label: "Напрямки послуг (з орієнтовними цінами)", fact: true } },
    priceRange: { min: 200, max: 100000 },
    exampleServices: ["Консультація", "Складання договорів", "Супровід угод", "Представництво в суді"],
    imagePrompts: [
      heroPrompt("calm abstract architectural light falling across clean stone columns and paper textures"),
      heroPrompt("muted geometric play of soft window light on layered paper and marble surfaces"),
    ],
    // Deep blues into indigo — the trust colours; the seed picks the shade.
    hueRanges: [{ from: 210, to: 260 }],
  },
  autoservice: {
    id: "autoservice",
    label: "Автосервіс / СТО",
    aliases: ["авто", "сто", "шиномонт", "ремонт авто", "діагностик", "автомийк", "автосервіс"],
    personaHint: "власник автосервісу, СТО або шиномонтажу",
    genHint: "енергійно, технічно й впевнено; акценти на переліку послуг і як записатися",
    advisorGuidance:
      "Типове для СТО: діагностика, ремонт двигуна й ходової, шиномонтаж, заміна масла; запис — подзвонити або лишити номер (передзвонимо). Спеціалізацію виводь з наявних даних; адресу з орієнтиром, години та ціни додавай лише якщо відомі.",
    fields: { ...baseFields, services: { label: "Послуги (напр. діагностика, ремонт)", fact: true } },
    priceRange: { min: 100, max: 50000 },
    exampleServices: ["Комп'ютерна діагностика", "Заміна масла", "Шиномонтаж", "Ремонт ходової"],
    imagePrompts: [
      heroPrompt("dark metallic bokeh with faint silhouettes of tools receding into shadow, brushed-steel highlights"),
      heroPrompt("abstract reflections on polished metal surfaces under cool industrial light and depth"),
    ],
    // Steel and slate through to workshop blue — cool, technical, never pastel.
    hueRanges: [{ from: 195, to: 250 }],
  },
  "pet-grooming": {
    id: "pet-grooming",
    label: "Грумінг / догляд за тваринами",
    aliases: ["грумінг", "грумер", "тварин", "собак", "котів", "зоо"],
    personaHint: "власник грумінг-салону або майстер з догляду за тваринами",
    genHint:
      "тепло, дбайливо й з любов'ю до хвостатих; акценти на послугах, фото робіт «до/після» і турботі про комфорт тварини",
    advisorGuidance:
      "Типове для грумінг-салону: комплексний грумінг, стрижка, купання, тримінг, гігієнічні процедури; ціни часто залежать від розміру чи породи. З якими тваринами працює (собаки, коти) — виводь з фото й Instagram; ціни та адресу додавай лише якщо відомі.",
    fields: { ...baseFields, services: { label: "Послуги (напр. стрижка, купання)", fact: true } },
    priceRange: { min: 100, max: 10000 },
    exampleServices: ["Комплексний грумінг", "Гігієнічна стрижка", "Купання та сушка", "Тримінг"],
    imagePrompts: [
      heroPrompt("soft pastel towels and gentle foam bubbles in warm cozy light, fluffy textures"),
      heroPrompt("out-of-focus soft fur textures and pastel grooming ribbons in airy morning light"),
    ],
    // Soft mint/aqua, or the pink→peach band that wraps past 360°.
    hueRanges: [
      { from: 160, to: 200 },
      { from: 330, to: 20 },
    ],
  },
  generic: {
    id: "generic",
    label: "Бізнес / послуги",
    aliases: [],
    personaHint: "власник малого бізнесу у сфері послуг або торгівлі",
    genHint: "чисто, дружньо й професійно; акценти на послугах/товарах і контактах",
    advisorGuidance:
      "Тип бізнесу і його пропозицію виводь з наявних даних (Instagram, фото, розмова). На сайт зазвичай варто винести: послуги або товари, контакти та як замовити чи звернутися; ціни й години — лише якщо відомі. Веди дуже просто, як консультант для людини, що не знає, що писати на сайті.",
    fields: baseFields,
    priceRange: { min: 20, max: 100000 },
    exampleServices: ["Основна послуга", "Додаткова послуга", "Консультація"],
    imagePrompts: [
      heroPrompt("soft brand-colored abstract gradient with gentle flowing light and subtle grain texture"),
      heroPrompt("minimal out-of-focus abstract shapes in warm neutral tones with soft diffused light"),
    ],
    // Unknown trade — no defensible narrowing, so the whole wheel stays open.
    hueRanges: [{ from: 0, to: 360 }],
  },
};

export const VERTICAL_IDS: string[] = Object.keys(verticals);

export function getVertical(id?: string | null): VerticalConfig {
  return (id && verticals[id]) || verticals.generic;
}

// Instagram businessCategoryName → vertical (refactor 03 §2.5): the scraped
// category is the strongest classification signal we have (a groomer whose
// text mentions «краса» must still land on pet-grooming). Substring matched,
// case-insensitive, checked BEFORE the alias fallback.
const IG_CATEGORY_MAP: Record<string, string> = {
  "pet groomer": "pet-grooming",
  "pet service": "pet-grooming",
  bakery: "bakery",
  florist: "florist",
  lawyer: "lawyer",
  automotive: "autoservice",
};

/** Keyword fallback classifier (the agent also returns its own guess).
 *  `opts.igCategory` — IG businessCategoryName; matched first when given. */
export function classifyVertical(text: string, opts?: { igCategory?: string }): string {
  const cat = opts?.igCategory?.toLowerCase();
  if (cat) {
    for (const [needle, id] of Object.entries(IG_CATEGORY_MAP)) {
      if (cat.includes(needle)) return id;
    }
  }
  const t = text.toLowerCase();
  for (const v of Object.values(verticals)) {
    if (v.id === "generic") continue;
    if (v.aliases.some((a) => t.includes(a))) return v.id;
  }
  return "generic";
}
