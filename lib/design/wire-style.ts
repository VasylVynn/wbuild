import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getAnthropic, isAnthropicConfigured, GEN_MODEL } from "@/lib/ai/anthropic";

/**
 * Wireframe styling — where a site's design actually comes from.
 *
 * The model is handed the wireframe's own source (the class contract) and one
 * business brief, and returns a stylesheet. It is told exactly one prohibition:
 * do not touch layout. Everything else — colour, type weight, shadow, radius,
 * spacing, alignment, pseudo-elements — is its call. No palette, no preset, no
 * curated list. That freedom is what makes two sites in one niche look
 * genuinely different instead of recolouring the same template.
 */

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
- будь-які кольори, які ти сам вважаєш правильними для цього бізнесу. НЕ обмежуйся «безпечними» відтінками і НЕ бери кольори з якогось стандартного набору — обери палітру свідомо, під галузь, настрій і аудиторію
- фони: суцільні, градієнти, тонкі патерни через background-image, різні фони для різних секцій
- типографіка: розміри, вага, letter-spacing, line-height, text-transform, оптичні розміри
- box-shadow, border, border-radius, outline
- padding і margin ВСЕРЕДИНІ секцій
- align-items, justify-content, text-align, gap
- ::before / ::after для декору, роздільників, лічильників, акцентних смуг
- transition і hover-стани
- --wire-split-order, щоб перекинути фото switchback ліворуч або праворуч

ЩО КАТЕГОРИЧНО ЗАБОРОНЕНО — усе, що ламає адаптивність:
- display, flex-direction, grid-template-columns, grid-template-areas, grid-auto-flow
- position: absolute / fixed / sticky (крім того, що вже є; position: relative на контейнері для якоріння власного декору — можна), float
- фіксовані width / height / min-width на контейнерах і картках (max-width на тексті — можна)
- overflow, який ховає контент
- будь-які @media, що звужують уже наявні брейкпоінти або ламають мобільний вигляд
- display:none на секціях чи їхньому вмісті
- @import, url() на зовнішні домени, будь-які шрифти ззовні

ШРИФТ: у цьому експерименті шрифт ОДИН і вже заданий. Не підключай нові сімʼї, не пиши font-family. Працюй вагою, розміром, трекінгом і регістром.

ЯКІСТЬ — це те, за чим тебе оцінюють:
- контраст тексту до фону мусить бути читабельним (щонайменше 4.5:1 для основного тексту)
- дизайн має бути ЦІЛІСНИЙ: одна ідея, проведена через усі секції, а не набір різних смаків
- він має бути ВПІЗНАВАНО про цей бізнес. Салон краси, автосервіс і юридична фірма мусять отримати три різні світи, а не один світ у трьох кольорах
- уникай дефолтного «AI-вигляду»: фіолетові градієнти на білому, Inter-подібна сірість, однакові скруглені картки з мʼякою тінню

ВИВІД: тільки CSS. Без markdown, без \`\`\`, без пояснень. Кожен селектор має починатися з .tpl-salonwire, щоб стилі не витекли назовні.`;

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
 */
function hueLine(hue: number): string {
  return `\nКОЛІРНИЙ ЯКІР: побудуй палітру навколо відтінку ≈${hue}° (як hue в OKLCH). Це СТАРТОВА ТОЧКА, не обмеження — сам добери тон і насиченість так, щоб результат пасував саме цьому бізнесу. Якщо для нього цей відтінок доречний лише як акцент на нейтральному тлі — зроби його акцентом. Не бери «типову» палітру для цієї галузі: відштовхуйся від якоря.`;
}

export async function generateWireStyle(
  brief: string,
  opts: { hue?: number } = {},
): Promise<WireStyleResult> {
  if (!isAnthropicConfigured()) throw new Error("ANTHROPIC_API_KEY not set");
  const { css, tsx } = await wireframeSource();
  const client = getAnthropic();
  const anchor = typeof opts.hue === "number" ? hueLine(((opts.hue % 360) + 360) % 360) : "";

  const res = await client.messages.create({
    model: GEN_MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: { effort: "high" },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `БІЗНЕС:
${brief}${anchor}

КАРКАС — базовий CSS (ці правила ЗАФІКСОВАНІ, вони тримають адаптивність; ти пишеш поверх них):
\`\`\`css
${css}
\`\`\`

КАРКАС — розмітка секцій (звідси бери реальні назви класів):
\`\`\`tsx
${tsx}
\`\`\`

Напиши CSS, який зробить із цього каркаса сайт для описаного бізнесу.`,
      },
    ],
  });

  const text = res.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("\n")
    .trim();

  // Models occasionally wrap output in a fence despite the instruction.
  const unfenced = text.replace(/^```(?:css)?\s*/i, "").replace(/\s*```$/i, "");

  return {
    css: unfenced,
    usage: { input: res.usage.input_tokens, output: res.usage.output_tokens },
  };
}
