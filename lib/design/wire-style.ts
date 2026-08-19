import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { llmCreate, isLlmConfigured, GEN_MODEL } from "@/lib/ai/llm";
import { FONT_FAMILIES, getFontPair } from "@/lib/design/font-pairs";
import { extractSectionSource } from "@/lib/design/wire-source";
import { salonwireSections } from "@/components/templates/salonwire";
import { createLogger } from "@/lib/log";
import type { DesignSpec, SectionPlanEntry } from "@/lib/site/design-spec";

/**
 * Wireframe styling — where a site's design actually comes from.
 *
 * The model is handed the wireframe's own source (the class contract) and one
 * business brief, and returns a stylesheet. Layout is off-limits (wire.css owns
 * it), fonts and motion are code-owned facts stated by the brief (pipeline v2
 * §1/§3-S3) — everything else on the SURFACE (colour, type weight, shadow,
 * radius, spacing, pseudo-elements) is its call. The one carve-out is IDENTITY
 * (V9): the brand mark is the owner's pixels and its lockups take no ornaments,
 * because a sheet hung a decorative dot beside a tenant's logo. The prompt
 * states that rule so the model spends its output on what will survive —
 * css-lint enforces it either way, and a stripped rule the model believed in
 * leaves a sheet reasoning about decor that is no longer there. A v2 designSpec anchors the
 * palette roles; without one the colour world is fully the model's. That
 * freedom is what makes two sites in one niche look genuinely different
 * instead of recolouring the same template.
 *
 * Prompt size (spec §6 note, V5): wire.css always goes in FULL — it is the
 * layout contract. sections.tsx is slimmed to the sectionPlan's sections (plus
 * the always-injected ones) when a designSpec exists; see wire-source.ts.
 */

const log = createLogger("wire-style");

/** The wireframe every site is composed against — the only one there is. */
export const WIRE_TEMPLATE_ID = "salonwire";

const WIRE_DIR = path.join(process.cwd(), "components", "templates", "salonwire");

async function wireframeSource(): Promise<{ css: string; tsx: string }> {
  const [css, tsx] = await Promise.all([
    readFile(path.join(WIRE_DIR, "wire.css"), "utf8"),
    readFile(path.join(WIRE_DIR, "sections.tsx"), "utf8"),
  ]);
  return { css, tsx };
}

const SYSTEM = `Ти — сильний веб-дизайнер, який пише CSS руками. Тобі дають структурний каркас сайту (responsive wireframe) і опис бізнесу. Твоє завдання — написати ОДИН CSS-файл, який перетворює цей сірий каркас на завершений, характерний сайт саме для цього бізнесу.

ЩО ТОБІ ДОЗВОЛЕНО — майже все, що стосується ПОВЕРХНІ:
- кольори. Якщо бриф нижче задає РОЛІ ПАЛІТРИ (тло/поверхня/текст/акцент) — збудуй палітру НАВКОЛО цих якорів: тон, нюанси, проміжні відтінки, похідні для рамок, тіней і декору — твої; якорі тримають кольоровий світ, а не диктують кожен піксель. Якщо ролей у брифі нема — обери палітру повністю сам: свідомо, під галузь, настрій і аудиторію, а не з якогось «безпечного» стандартного набору
- фони: суцільні, градієнти, тонкі патерни через background-image, різні фони для різних секцій
- типографіка: розміри, вага, letter-spacing, line-height, text-transform, оптичні розміри
- box-shadow, border, border-radius, outline
- padding і margin ВСЕРЕДИНІ секцій
- align-items, justify-content, text-align, gap
- ::before / ::after для декору, роздільників, лічильників, акцентних смуг — у секціях. Виняток один: знак бренду (див. нижче)
- transition і hover-стани
- 1–2 делікатні анімації через @keyframes (напр. мʼяке проявлення акценту, легкий підйом картки на hover). Каркас уже має власний scroll-reveal і базові transition — не дублюй їх і не роби нічого, що смикається чи блимає. НЕ загортай анімації в @media: усі @media з твого CSS вирізаються, лишиться порожньо
- --wire-split-order, щоб перекинути фото switchback ліворуч або праворуч
- --wire-scrim і --wire-banner-ink, якщо hero прийшов у макеті banner (фото на весь екран): затемнення поверх фото і колір тексту на ньому

ЩО КАТЕГОРИЧНО ЗАБОРОНЕНО — усе, що ламає адаптивність:
- display, flex, flex-wrap, flex-direction, order, align-self, aspect-ratio, columns, grid-template-columns, grid-template-areas, grid-auto-flow, grid-column/row — усе це вирізається лінтером
- геометрія шапки, лого-знака, бейджа, форми заявки і галереї (.wire-nav*, .wire-brandmark, .wire-badge, .wire-leadform__form, .wire-gallery__masonry): розмір, overflow і position там теж вирізаються — фарбуй їх, але не переставляй
- position: absolute / fixed / sticky (крім того, що вже є; position: relative на контейнері для якоріння власного декору — можна), float
- фіксовані width / height / min-width на контейнерах і картках (max-width на тексті — можна)
- overflow, який ховає контент
- будь-які @media, що звужують уже наявні брейкпоінти або ламають мобільний вигляд
- display:none на секціях чи їхньому вмісті
- @import, url() на зовнішні домени, будь-які шрифти ззовні

ЗНАК БРЕНДУ — це ідентичність бізнесу, а не поверхня. Це єдине місце сторінки, де декор заборонений:
- .wire-brandmark, .wire-nav__logo, .wire-footer__logo — це піксели власника, його лого. Не перефарбовуй і не переробляй його: background, opacity, visibility, filter, backdrop-filter, mix-blend-mode, mask, clip-path, transform і content там вирізаються. Твоє тут — тільки --wire-brandmark-size і --wire-brandmark-max
- .wire-nav__brandlock, .wire-nav__brand, .wire-footer__brandlock — лого-блоки в шапці й у футері. Колір, шрифт, вага, трекінг, фон самого блока — ТВОЇ, це і є характер шапки. Але ::before / ::after на них вирізаються цілком: жодних крапок, рисок, зірочок чи іконок біля лого й назви бізнесу
- у всіх інших секціях ::before / ::after лишаються твоїми в повному обсязі

CODE-ЗМІННІ (не пиши їх — вирізаються): --font-heading, --font-body, --wire-brandmark-plate (колір, ЗАМІРЯНИЙ з пікселів лого власника), --wire-hero-focus (точка кадрування реального фото). Це виміри, а не смак.

ЩЕ ТРИ ВЛАСТИВОСТІ, які вирізаються всюди: content поза ::before/::after (він підміняє вміст елемента, а не декорує його — на <img> просто замінює лого), all (скидає одразу все правило каркаса) і content-visibility / contain (ховають або обрізають контент).

ШРИФТИ: шрифтову пару (заголовки/основний текст) задає бриф, а підключає код при рендері. НЕ пиши font-family і НЕ чіпай змінні --font-heading/--font-body — вони будуть вирізані. Твої інструменти — вага, розмір, letter-spacing, line-height, регістр.

MOTION: рівень руху задає бриф (0 — статика … 3 — виразний рух); носій рівня — код. Твої transition, hover-стани і 1–2 @keyframes мають відповідати заявленому рівню: на 0–1 — стриманість, на 2–3 — помітніші, але досі делікатні появи.

ПАЛІТРА — дисципліна, без якої сайт розсипається:
- структура рольова: основне тло + друга поверхня для чергування секцій і карток плюс ОДИН акцент на дію: кнопки, ціни, активні стани. Відтінки тексту — не «третій колір». Задані в брифі ролі — якорі цієї структури: не міняй їхню суть (світле тло має лишитись світлим, акцент — упізнаваним), нюансуй і доповнюй вільно
- насиченість узгоджена: або весь набір приглушений, або весь насичений. Пастель поруч із кислотним — це поламана палітра
- жодних кислотних сполучень (неон на неоні, чистий #00FF00, вібруючі доповнювальні пари) — вони читаються як помилка, а не як сміливість
- акцент має бути один і впізнаваний; якщо все кричить, не кричить ніщо

ЯКІСТЬ — це те, за чим тебе оцінюють:
- контраст тексту до фону мусить бути читабельним (щонайменше 4.5:1 для основного тексту)
- дизайн має бути ЦІЛІСНИЙ: одна ідея, проведена через усі секції, а не набір різних смаків
- він має бути ВПІЗНАВАНО про цей бізнес. Салон краси, автосервіс і юридична фірма мусять отримати три різні світи, а не один світ у трьох кольорах
- уникай дефолтного «AI-вигляду»: фіолетові градієнти на білому, Inter-подібна сірість, однакові скруглені картки з мʼякою тінню

ВИВІД: тільки CSS. Без markdown, без \`\`\`, без пояснень. Кожен селектор має починатися з .tpl-salonwire, щоб стилі не витекли назовні.

КОНТРАСТ (жорстке правило): кожен текстовий клас у КОЖНОМУ контексті (hero, картка, футер) отримує ВЛАСНУ declaration кольору — ніколи не перевикористовуй одне значення на різних фонах. Перед тим як записати пару «текст/фон», перевір подумки контраст ≥4.5:1; світлий текст лише на явно темному фоні й навпаки.
- Кольори тексту і фонів пиши ЛИШЕ літеральними hex-значеннями (#rrggbb) — НІКОЛИ через var() чи кастомні властивості: пару з var() автоматика контрасту не може перевірити й виправити, і саме такі пари ламаються.
- Однорідні списки (питання FAQ, картки послуг, пункти переваг) фарбуються ОДНАКОВО — жодних «деякі заголовки акцентні, деякі ні».`;

export type WireStyleResult = {
  css: string;
  usage: { input: number; output: number };
};

/**
 * A seeded HUE anchor — the answer to same-niche convergence (measured: two
 * grooming salons both landed in warm cream with no anchor).
 *
 * Deliberately an anchor on colour, not on style. A seeded *style* direction
 * ("brutalist", "organic") buys variety by breaking FIT: brutalism contradicts
 * a grooming salon's whole promise. A hue does not — almost any hue can be made
 * to feel caring at the right tone and chroma, so the model keeps deciding what
 * suits the business while the seed decides which colour world it starts from.
 *
 * The roll itself is no longer uniform over the circle: `lib/design/hue.ts`
 * confines it to the windows the vertical declares, because "any hue can be
 * made to work" stopped being true once a bakery drew an acid green.
 */
function hueLine(hue: number): string {
  return `\nКОЛІРНИЙ ЯКІР: побудуй палітру навколо відтінку ≈${hue}° (як hue в OKLCH). Це СТАРТОВА ТОЧКА, не обмеження — сам добери тон і насиченість так, щоб результат пасував саме цьому бізнесу. Якщо для нього цей відтінок доречний лише як акцент на нейтральному тлі — зроби його акцентом. Якір уже забезпечує різноманіття між сайтами, тому не тікай навмисне від того, що звично для галузі: пекарня має право виглядати як пекарня. Просто не зупиняйся на першому очевидному рішенні.`;
}

/**
 * The S1 design brief rendered for the STYLIST call (pipeline v2 §3: «палітра —
 * якір, не диктат»). Same manner as the hue anchor: roles are where the colour
 * world STARTS, tone and nuance stay the model's. Pure — exported for vitest.
 *
 * Fonts/motion are stated as facts the code owns (injected at render from
 * designSpec, never a wireCss line): the model needs to know the pair's
 * character to set weights/tracking, and the level to scale its transitions.
 */
export function designSpecStyleLines(spec: DesignSpec): string {
  const p = spec.palette;
  const pair = getFontPair(spec.typography.pairId);
  const lines = [
    "",
    "РОЛІ ПАЛІТРИ (якорі з дизайн-брифу — збудуй палітру навколо них; тон, нюанси й похідні відтінки твої):",
    `- тло: ${p.bg}; поверхня: ${p.surface}; основний текст: ${p.ink}`,
    `- акцент дії: ${p.accent}; текст на акценті: ${p.accentInk}`,
  ];
  if (pair) {
    lines.push(
      `ТИПОГРАФІКА: заголовки — ${FONT_FAMILIES[pair.heading].label}, текст — ${FONT_FAMILIES[pair.body].label} (підключає код — font-family не пиши; передай характер цих шрифтів вагою, розміром і трекінгом).`,
    );
  }
  lines.push(
    `MOTION: рівень ${spec.motion.level} з 3${spec.motion.notes ? ` — ${spec.motion.notes}` : ""}.`,
  );
  if (spec.positioning.tone) lines.push(`ТОН ПОДАЧІ: ${spec.positioning.tone}.`);
  if (spec.imagery.treatment) lines.push(`ФОТО: ${spec.imagery.treatment}.`);
  return lines.join("\n");
}

/**
 * Block types whose sections.tsx source the stylist needs: the sectionPlan's
 * sections mapped through the wireframe registry, plus the ones a plan never
 * carries but the page can always render — hero (protected, LCP) and the
 * force-injected lead_form/contacts/gallery (invariant 8). The seed set MUST
 * mirror `PLAN_EXEMPT_TYPES` in `lib/ai/generate.ts` (not imported — that
 * would be a circular dependency): gallery in particular is injected outside
 * any plan whenever ≥2 photos exist or a generated-atmosphere batch is
 * pending, so dropping its source would ship it unstyled (`.wire-gallery` is
 * not in wire.css). Nav/footer chrome lives in SalonWireWrapper (never sent)
 * — its classes come from wire.css, unchanged. Exported for vitest.
 */
export function plannedBlockTypes(plan: readonly SectionPlanEntry[]): Set<string> {
  const types = new Set<string>(["hero", "lead_form", "contacts", "gallery"]);
  for (const entry of plan) {
    const block = salonwireSections[entry.section]?.block;
    if (block) types.add(block);
  }
  return types;
}

export async function generateWireStyle(
  brief: string,
  // v2 path passes `designSpec` (palette roles supersede the bare hue anchor —
  // `hue` is then ignored); v1 fallback passes `hue` only and behaves exactly
  // as before the brief existed.
  opts: { hue?: number; signal?: AbortSignal; designSpec?: DesignSpec } = {},
): Promise<WireStyleResult> {
  if (!isLlmConfigured()) throw new Error("OPENAI_API_KEY not set");
  const { css, tsx } = await wireframeSource();
  // Slim the markup context to the planned sections (V5): only possible with a
  // designSpec — the v1 fallback can't know the composition, so it keeps the
  // whole file, exactly the pre-V5 behavior.
  const { source: tsxForPrompt, extracted } = opts.designSpec
    ? extractSectionSource(tsx, plannedBlockTypes(opts.designSpec.sectionPlan))
    : { source: tsx, extracted: false };
  const anchor = opts.designSpec
    ? designSpecStyleLines(opts.designSpec)
    : typeof opts.hue === "number"
      ? hueLine(((opts.hue % 360) + 360) % 360)
      : "";

  // OpenAI prompt caching is AUTOMATIC on stable prefixes — the framework
  // block leads the message for exactly that reason (no cache_control markup).
  // Luna + high reasoning (owner call 2026-08-19): the nano tier writes the
  // 16k sheet well inside the 150s S2а budget.
  const res = await llmCreate({
    model: GEN_MODEL,
    max_tokens: 16000,
    effort: "high",
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text" as const,
            text: `КАРКАС — базовий CSS (ці правила ЗАФІКСОВАНІ, вони тримають адаптивність; ти пишеш поверх них):
\`\`\`css
${css}
\`\`\`

КАРКАС — розмітка секцій (звідси бери реальні назви класів):
\`\`\`tsx
${tsxForPrompt}
\`\`\``,
          },
          {
            type: "text" as const,
            text: `БІЗНЕС:
${brief}${anchor}

Напиши CSS, який зробить із цього каркаса сайт для описаного бізнесу.`,
          },
        ],
      },
    ],
    // One attempt IS the S2а/S4-regen stage budget — a failed call degrades
    // (prev sheet / floor) instead of retrying past the deadline.
    signal: opts.signal,
  });

  const text = res.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("\n")
    .trim();

  // Models occasionally wrap output in a fence despite the instruction.
  const unfenced = text.replace(/^```(?:css)?\s*/i, "").replace(/\s*```$/i, "");

  // Prompt-size telemetry (V5): budget tuning is data-driven — every call logs
  // what the slimming actually saved and what the API actually counted.
  log.info("style prompt size", {
    extracted,
    tsxFullChars: tsx.length,
    tsxSentChars: tsxForPrompt.length,
    cssChars: css.length,
    inputTokens: res.usage.input_tokens,
    outputTokens: res.usage.output_tokens,
    // Cache verification (2026-08-10): read>0 = the framework prefix hit;
    // write>0 = this call warmed it (1.25×). Both zero on repeat = silent
    // invalidator, go look for byte drift in the prefix.
    cacheRead: res.usage.cache_read_input_tokens ?? 0,
    cacheWrite: res.usage.cache_creation_input_tokens ?? 0,
  });

  return {
    css: unfenced,
    usage: { input: res.usage.input_tokens, output: res.usage.output_tokens },
  };
}
