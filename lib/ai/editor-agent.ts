import "server-only";
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import type { StoredBlock } from "@/lib/blocks/schema";
import type { PageSeo } from "@/lib/tenant/types";
import { blockLibrary } from "@/lib/blocks/library";
import { skinsFor } from "@/lib/blocks/skins";
import { themePresets } from "@/lib/theme/presets";
import { businessFactsSchema, type BusinessFacts } from "@/lib/verticals/schema";
import { getVertical } from "@/lib/verticals/registry";

/**
 * Editor agent (redesign plan P3): one assistant that combines the roles the
 * owner would otherwise hire — structure engineer, copywriter/marketer, SEO
 * advisor, business analyst. It TALKS in the editor chat and ACTS only through
 * tools; every mutation goes down the same validated draft path as manual
 * edits (validateBlocks + §4.8 image stripping), never straight to the DB.
 *
 * Model contour (validator must-fix #3): extended thinking needs
 * tool_choice:auto — the loop runs thinking + auto tools; strict per-block
 * schema enforcement happens in the EXECUTORS (parseBlockProps path), not via
 * a forced tool.
 */

export type EditorChatMsg = { role: "user" | "assistant"; content: string };

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

const idx = z.number().int().min(0).describe("Номер блоку зі списку ПОТОЧНІ БЛОКИ (0-based).");

export const toolInputSchemas = {
  update_block: z.object({
    index: idx,
    props: z.record(z.string(), z.unknown()).describe("ПОВНИЙ новий обʼєкт props блоку (не патч)."),
  }),
  add_block: z.object({
    type: z.string().describe("Тип блоку (напр. services, faq, gallery, text)."),
    position: z.number().int().min(0).describe("Куди вставити (0 = перед першим блоком)."),
    props: z.record(z.string(), z.unknown()).describe("Повний props нового блоку за схемою типу."),
  }),
  remove_block: z.object({ index: idx }),
  move_block: z.object({ index: idx, to: z.number().int().min(0).describe("Нова позиція.") }),
  set_hidden: z.object({ index: idx, hidden: z.boolean() }),
  set_skin: z.object({ index: idx, skin: z.string().describe("Ідентифікатор скіна зі списку доступних.") }),
  regenerate_block: z.object({
    index: idx,
    instruction: z
      .string()
      .max(500)
      .describe("Що саме переписати/покращити у вмісті цього блоку (текстова інструкція)."),
  }),
  switch_theme: z.object({ presetId: z.string().describe("Ідентифікатор пресета оформлення.") }),
  switch_pack: z.object({ packId: z.string().describe("Ідентифікатор дизайн-пакета.") }),
  // D5: page SEO meta. Draft-only like every other tool — goes live on publish.
  set_seo: z.object({
    title: z
      .string()
      .optional()
      .describe("SEO-title сторінки, до 60 символів: «{головна послуга} у {місто} — {назва}»."),
    description: z
      .string()
      .optional()
      .describe("SEO-опис для Google, до 150 символів: продаюча суть із містом і нішею, без лапок."),
  }),
  // Refactor 03 §3.3 / 04 §1: editor power tools. All draft-scoped; none touch
  // published content directly (publish stays human-only, invariant 6).
  update_facts: z.object({
    patch: businessFactsSchema
      .partial()
      .describe(
        "Часткові оновлені факти бізнесу — лише поля, що змінюються (телефон, адреса, години, послуги...). last-wins: нове значення заміняє старе для кожного вказаного поля.",
      ),
  }),
  refresh_instagram: z.object({
    handle: z
      .string()
      .optional()
      .describe("Instagram-нікнейм або посилання для пересканування; якщо не вказано — береться facts.instagram."),
  }),
  analyze_photo: z.object({
    url: z.string().describe("URL фото в НАШОМУ Storage (з чату чи вже наявного блоку) для аналізу."),
  }),
  inspect_site: z.object({}),
} as const;

export type ToolName = keyof typeof toolInputSchemas;

const TOOL_DESCRIPTIONS: Record<ToolName, string> = {
  update_block: "Замінити вміст (props) одного блоку. Використовуй для правок текстів, цін, пунктів.",
  add_block: "Додати новий блок на сторінку. Спочатку впевнись, що знаєш схему типу з наявних блоків.",
  remove_block: "Видалити блок зі сторінки назавжди (є прихований буфер чернетки — це безпечно).",
  move_block: "Перемістити блок на нову позицію.",
  set_hidden: "Приховати або показати блок (мʼякша альтернатива видаленню).",
  set_skin: "Змінити ВИГЛЯД блоку (розкладку), не чіпаючи вміст.",
  regenerate_block:
    "Переписати вміст блоку за інструкцією силами окремого редактора (для великих текстових переробок).",
  switch_theme: "Змінити кольорове оформлення сайту (пресет).",
  switch_pack: "Змінити цілісний дизайн-пакет (тема + розкладки всіх блоків).",
  set_seo:
    "Оновити SEO-заголовок і/або SEO-опис сторінки (те, що бачить Google). Потрапляє на живий сайт після «Опублікувати».",
  update_facts:
    "Оновити факти бізнесу (телефон, адреса, години, послуги з цінами тощо). Використовуй, коли власник називає нову/виправлену інформацію або підтверджує кандидата з Instagram/фото. Онови факти ПЕРШИМ, тоді за потреби онови залежні блоки (contacts/services) іншим інструментом.",
  refresh_instagram:
    "Пересканувати Instagram-профіль (глибоко: біо, до ~20 постів, фото) і отримати свіжі дані. Використовуй, коли власник просить перевірити/оновити дані з інстаграму, згадує нові пости чи фото, або поточні дані виглядають застарілими. Обмежено кількістю сканувань на день.",
  analyze_photo:
    "Проаналізувати одне фото зі Storage: що на ньому, який текст, які телефони/ціни/адреси видно. Використовуй для щойно завантаженого власником фото, якщо ще не бачив його аналізу.",
  inspect_site:
    "Перевірити чернетку сайту на вигадані факти, суперечності між блоками й невідповідність вертикалі. Виклич перед фінальним «готово» після серії правок або коли власник просить перевірити сайт.",
};

/** Ukrainian action label per tool — streamed as {t:"tool",label} while it runs
 * (04 §2: the owner watches the agent work, not a generic spinner). Exhaustive
 * over ToolName so the UI never has to fall back to a raw English tool name. */
export const TOOL_LABELS: Record<ToolName, string> = {
  update_block: "Оновлюю секцію…",
  add_block: "Додаю секцію…",
  remove_block: "Прибираю секцію…",
  move_block: "Переставляю секцію…",
  set_hidden: "Змінюю видимість секції…",
  set_skin: "Змінюю вигляд секції…",
  regenerate_block: "Переписую текст секції…",
  switch_theme: "Змінюю оформлення…",
  switch_pack: "Змінюю дизайн-пакет…",
  set_seo: "Оновлюю SEO…",
  update_facts: "Оновлюю дані…",
  refresh_instagram: "Зазираю в Instagram…",
  analyze_photo: "Аналізую фото…",
  inspect_site: "Перевіряю сайт…",
};

export function buildTools(): Anthropic.Beta.BetaTool[] {
  return (Object.keys(toolInputSchemas) as ToolName[]).map((name) => ({
    name,
    description: TOOL_DESCRIPTIONS[name],
    input_schema: z.toJSONSchema(toolInputSchemas[name]),
  })) as unknown as Anthropic.Beta.BetaTool[];
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

function trimStr(v: unknown, max = 400): unknown {
  if (typeof v === "string") return v.length > max ? `${v.slice(0, max)}…` : v;
  if (Array.isArray(v)) return v.map((x) => trimStr(x, max));
  if (v && typeof v === "object")
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, trimStr(x, max)]));
  return v;
}

export function describeBlocks(blocks: StoredBlock[]): string {
  return blocks
    .map((b, i) => {
      const label = blockLibrary[b.type]?.label ?? b.type;
      const skins = skinsFor(b.type).map((s) => s.id);
      const meta = [
        b.hidden ? "ПРИХОВАНИЙ" : null,
        b.skin ? `skin=${b.skin}` : null,
        b.section ? `section=${b.section}` : null,
        skins.length ? `доступні скіни: ${skins.join(", ")}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      return `[${i}] ${b.type} («${label}»)${meta ? ` — ${meta}` : ""}\nprops: ${JSON.stringify(trimStr(b.props))}`;
    })
    .join("\n\n");
}

export function buildEditorSystem(ctx: {
  businessName: string;
  verticalId: string;
  facts: Partial<BusinessFacts>;
  blocks: StoredBlock[];
  themeOptions: { id: string; label: string }[];
  isTemplateSite: boolean;
  onboardingTranscript: EditorChatMsg[] | null;
  stats: { views7: number; leads7: number } | null;
  seo?: PageSeo;
  /** Business Dossier (refactor §1.5), pre-formatted by formatDossierForPrompt —
   * Instagram bio/candidates/posts, per-photo media inventory, brand-voice cues.
   * Built once per request by the route; undefined when unavailable (no
   * Supabase, no snapshot yet) — the prompt degrades gracefully without it. */
  dossier?: string;
}): string {
  const vertical = getVertical(ctx.verticalId);
  const themes = ctx.themeOptions.map((t) => `${t.id} («${t.label}»)`).join(", ");
  const presetIds = Object.keys(themePresets).join(", ");

  const transcript = ctx.onboardingTranscript?.length
    ? ctx.onboardingTranscript
        .slice(-30)
        .map((m) => `${m.role === "user" ? "Власник" : "Помічник"}: ${String(trimStr(m.content, 300))}`)
        .join("\n")
    : null;

  return `Ти — особистий помічник власника сайту «${ctx.businessName}» (${vertical.label}) у редакторі 3minsite. В одній особі ти:
- ІНЖЕНЕР структури: додаєш/прибираєш/переставляєш секції, міняєш розкладки.
- КОПІРАЙТЕР і МАРКЕТОЛОГ: пишеш тексти, що продають — конкретні, теплі, без води й кліше.
- SEO-ПОРАДНИК: радиш, як сформулювати заголовки й тексти, щоб сайт знаходили в Google (локальні запити «послуга + місто»), і чесно кажеш, що SEO — це місяці, не дні. Можеш сам оновити SEO-заголовок і SEO-опис сторінки інструментом set_seo (title до 60 символів за формулою «{послуга} у {місто} — {назва}», description до 150 — продаюча суть із містом).
- БІЗНЕС-АНАЛІТИК: підказуєш, чого бракує сайту для заявок (ціни, довіра, заклик до дії).

ЯК ПРАЦЮВАТИ:
- Кожна зміна сайту — ТІЛЬКИ через інструменти. Ніколи не описуй зміну, не зробивши її інструментом.
- Зміни падають у ЧЕРНЕТКУ — на живий сайт вони потраплять лише коли власник натисне «Опублікувати». Публікувати сам ти НЕ можеш.
- Після інструментів коротко перелічи, що зробив, людською мовою. Якщо прохання неоднозначне — спершу постав одне уточнювальне питання.
- НЕ вигадуй фактів (телефони, адреси, ціни, назви) — бери з ФАКТІВ/ДОСЬЄ або запитай. Ціни можеш пропонувати як орієнтовні, явно кажучи про це.
- Пиши українською, тепло і по суті. Можна виділяти **жирним**. Жодної іншої розмітки.
- Мова — для НЕтехнічної людини: жодних IT-слів (не кажи «хендл», «скрейп», «лінк», «блок-схема», «валідація») — кажи «нікнейм», «загляну в профіль», «посилання», «секція». Термін неминучий — одразу поясни по-людськи.
- Фото: можеш лишити поле порожнім або попросити власника завантажити — вигадані URL заборонені й будуть відкинуті. Власник може прикріпити фото прямо в чаті — тоді ти бачиш ТЕКСТОВИЙ аналіз (не сам файл) і справжній URL, який можна вставити в блок через update_block/add_block.
- Якщо просять неможливе для платформи (магазин/оплата/кабінети/інтеграції/довільний код) — чесно відмов і згадай кнопку «Хочу кастомні зміни».

МОЖЛИВОСТІ ПОНАД РЕДАГУВАННЯ БЛОКІВ (чесно про те, що ти вмієш, і коли це використовувати):
- update_facts — власник назвав нову/виправлену інформацію (телефон, адреса, години, послуга з ціною) АБО підтвердив кандидата з Instagram/фото. Онови факти ПЕРШИМ, тоді за потреби онови залежні блоки (contacts/services) окремо.
- refresh_instagram — власник просить перевірити/оновити дані з Instagram, згадує нові пости чи фото, або поточні дані виглядають застарілими.
- analyze_photo — зʼявилось фото, чийого аналізу в цьому контексті ще немає (нове завантаження або URL з блоку), і власник питає про нього чи ти сам вирішив глянути перед кастингом у блок.
- inspect_site — перед фінальним «готово» після серії правок, або коли власник прямо просить перевірити сайт на помилки/суперечності.
- Фото прайсу/меню (kind=menu або знайдені ціни в аналізі): запропонуй update_facts зі знайденими послугами — явно скажи власнику, що це з фото і потребує підтвердження, не застосовуй мовчки.
- Публікація сайту — ЛИШЕ дія власника (кнопка «Опублікувати»); ти не можеш і ніколи не кажи, що можеш.

ФАКТИ БІЗНЕСУ (єдине джерело правди):
${JSON.stringify(ctx.facts)}
${ctx.dossier ? `\n${ctx.dossier}\n` : ""}
ПОТОЧНІ БЛОКИ СТОРІНКИ (нумерація для інструментів):
${describeBlocks(ctx.blocks)}

SEO СТОРІНКИ (чернетка; live після публікації):
- title: ${ctx.seo?.title ?? "— (не задано)"}
- description: ${ctx.seo?.description ?? "— (не задано)"}

ОФОРМЛЕННЯ: доступні пресети цієї вертикалі: ${themes}. Усі пресети платформи: ${presetIds}.${
    ctx.isTemplateSite
      ? "\nЦе САЙТ-ШАБЛОН: розкладка секцій належить шаблону; add_block використовуй обережно (новий блок може відрендеритись базовим виглядом)."
      : ""
  }${
    ctx.stats
      ? `\n\nСТАТИСТИКА за 7 днів: переглядів ${ctx.stats.views7}, заявок ${ctx.stats.leads7}.`
      : ""
  }${
    transcript
      ? `\n\nПАМʼЯТЬ — РОЗМОВА ПРИ СТВОРЕННІ САЙТУ (що власник розповідав про бізнес):\n${transcript}`
      : ""
  }`;
}
