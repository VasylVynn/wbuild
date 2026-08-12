import { blockLibrary } from "@/lib/blocks/library";

/**
 * The business brief handed to stylesheet generation (`generateWireStyle`).
 *
 * It used to be three lines — name, city, «Послуги: …» — while TEXT generation
 * got the vertical's label, persona and tone hints. That asymmetry is why two
 * bakeries came back looking the same: the designer half of the pipeline could
 * not tell one small business from another, so it fell back on a house style.
 * This assembles the same knowledge the copywriter already receives, plus what
 * the page actually contains, so the sheet is written for THIS composition.
 *
 * Everything here is either a user-confirmed fact copied verbatim or registry
 * data — nothing is invented, so §4.4 grounding is unaffected. Pure function:
 * no I/O, no model call.
 */

/** The facts the brief reads. `BusinessFacts` satisfies this structurally. */
export interface StyleBriefFacts {
  businessName: string;
  /** Optional since the V2 facts relax — a missing city is simply not said. */
  city?: string;
  about?: string;
  services?: { name: string }[];
}

/** The vertical fields the brief reads. `VerticalConfig` satisfies this. */
export interface StyleBriefVertical {
  id: string;
  label: string;
  personaHint?: string;
  genHint?: string;
}

const MAX_SERVICES = 8;

/** Ukrainian section names from the block library — the model reads names, not ids. */
function sectionNames(types: string[]): string[] {
  const labels = blockLibrary as Record<string, { label: string } | undefined>;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of types) {
    const name = labels[t]?.label ?? t;
    if (seen.has(name)) continue; // a page may carry two `services` blocks
    seen.add(name);
    out.push(name);
  }
  return out;
}

/**
 * Build the Ukrainian design brief for one tenant.
 *
 * @param input.facts user-confirmed business facts (copied, never paraphrased).
 * @param input.vertical the vertical config for this business.
 * @param input.sectionTypes block types of the composed page, in page order.
 * @returns a multi-line brief; every line is optional except the first, so a
 *   business with only a name and city still produces a usable brief.
 */
export function buildStyleBrief(input: {
  facts: StyleBriefFacts;
  vertical: StyleBriefVertical;
  sectionTypes?: string[];
}): string {
  const { facts, vertical, sectionTypes } = input;

  const niche = vertical.personaHint
    ? `${vertical.label} (${vertical.personaHint}).`
    : `${vertical.label}.`;
  const services = facts.services?.length
    ? facts.services
        .map((s) => s.name)
        .filter(Boolean)
        .slice(0, MAX_SERVICES)
        .join(", ")
    : "";
  const sections = sectionTypes?.length ? sectionNames(sectionTypes).join(" → ") : "";

  return [
    `Бізнес: ${facts.businessName}${facts.city?.trim() ? `, ${facts.city.trim()}` : ""}.`,
    `Ніша: ${niche}`,
    vertical.genHint ? `Настрій: ${vertical.genHint}.` : "",
    facts.about ? `Про бізнес: ${facts.about}` : "",
    services ? `Послуги: ${services}.` : "",
    sections ? `Секції сторінки згори вниз: ${sections}.` : "",
    // The two lines the old brief never said out loud. Both are about the job
    // the design has to do, not about taste — the model already has taste.
    "Хто дивиться: місцевий клієнт із телефона, який за десять секунд вирішує, чи лишати заявку. Дизайн має вести його до форми заявки, а не змагатися з нею.",
    "Це справжній малий бізнес, а не презентація бренду: він має виглядати доглянутим і живим, з характером саме цієї справи, а не як шаблон із конструктора.",
    // Owner decision 2026-08-12, after a live restyle they loved: the bar is
    // «дорого», said as craft rules the stylist can execute, not as a vibe.
    "Сайт має виглядати ДОРОГО. Практично це: тло й поверхні — глибокі або теплі напівтони, ніколи чисті #ffffff/#000000; ОДИН стриманий насичений акцент, а не кілька крикливих; щедре повітря між секціями; послідовна система заокруглень і тіней (мʼякших, ніж хочеться); текст — мʼякший за чистий чорний, заголовки з упевненим розміром і щільним трекінгом.",
    "Темна палітра — повноцінний і часто дорожчий напрям для майстерень, автосервісів, барберень, юристів і вечірніх закладів: глибоке темне тло, тепле світло, один точний акцент. Не тримайся світлого за замовчуванням.",
    "Дешевить і заборонено: базовий «як у всіх» синій, сірий #f5f5f5 із чорним текстом, конкурентні акценти, різкі чорні тіні, неон поза нішами, де він доречний.",
  ]
    .filter(Boolean)
    .join("\n");
}
