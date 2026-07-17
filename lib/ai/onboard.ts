import "server-only";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, CHAT_MODEL } from "./anthropic";
import { businessFactsSchema, type BusinessFacts } from "@/lib/verticals/schema";
import { getVertical, VERTICAL_IDS } from "@/lib/verticals/registry";
import type { VerticalConfig } from "@/lib/verticals/types";
import { validateFacts } from "@/lib/onboard/validate";

/**
 * Onboarding agent (brief §4.9 + owner feedback). The chat is only the
 * interface; the source of truth is a structured facts object. The agent is a
 * DOMAIN ADVISOR: classifies the vertical, proactively suggests what belongs on
 * the site, asks niche-specific questions, and validates facts.
 *
 * IMPORTANT: the user-facing message is normal assistant TEXT; the tool carries
 * ONLY structured data. Putting the message inside the tool's JSON caused
 * escaping artifacts (literal "\n") and mid-character truncation in Cyrillic
 * tool arguments — text output avoids both.
 */

export type ChatMsg = { role: "user" | "assistant"; content: string };

const factsPatchSchema = businessFactsSchema.partial();

const saveFactsSchema = z.object({
  verticalId: z.enum(VERTICAL_IDS as [string, ...string[]]),
  factsPatch: factsPatchSchema,
  status: z.enum(["collecting", "ready"]),
  quickReplies: z.array(z.string()).max(4).optional(),
});

const saveFactsTool = {
  name: "save_facts",
  description: "Зберегти структуровані дані з розмови: тип бізнесу, нові факти й статус готовності.",
  input_schema: z.toJSONSchema(
    z.object({
      verticalId: z
        .enum(VERTICAL_IDS as [string, ...string[]])
        .describe("Тип бізнесу зі списку; generic, якщо не підходить жоден."),
      factsPatch: factsPatchSchema.describe(
        "Лише НОВІ або змінені поля з останнього повідомлення користувача; масиви цілком.",
      ),
      status: z
        .enum(["collecting", "ready"])
        .describe("ready — коли зібрано достатньо для якісного сайту або користувач попросив 'просто згенеруй'."),
      quickReplies: z
        .array(z.string())
        .max(4)
        .optional()
        .describe(
          "2–4 короткі готові відповіді-чипи на ТВОЄ поточне питання (1–4 слова кожна), ЛИШЕ коли варіанти очевидні (напр. типи бізнесу, «Так»/«Ні», «Пропустити»). Не давай, коли відповідь вільна (назва, телефон).",
        ),
    }),
  ),
} as unknown as Anthropic.Tool;

/** Progress chip for the chat UI (design 1b): key facts and whether collected. */
export interface ProgressItem {
  key: string;
  label: string;
  done: boolean;
}

const PROGRESS_FIELDS: { key: keyof BusinessFacts; label: string }[] = [
  { key: "businessName", label: "Бізнес" },
  { key: "city", label: "Місто" },
  { key: "phone", label: "Телефон" },
  { key: "address", label: "Адреса" },
  { key: "hours", label: "Години" },
];

function computeProgress(facts: Partial<BusinessFacts>): ProgressItem[] {
  return PROGRESS_FIELDS.map(({ key, label }) => {
    const v = facts[key];
    return { key, label, done: v != null && String(v).trim().length > 0 };
  });
}

export interface OnboardTurnResult {
  message: string;
  facts: Partial<BusinessFacts>;
  verticalId: string;
  ready: boolean;
  /** Suggested one-tap answers for the CURRENT question (design 1c). */
  quickReplies: string[];
  /** Collected-facts chips (design 1b). */
  progress: ProgressItem[];
}

function fieldList(v: VerticalConfig): string {
  return Object.entries(v.fields)
    .map(([k, m]) => `- ${k}: ${m?.label ?? k}${m?.required ? " (обов'язкове)" : ""}`)
    .join("\n");
}

function buildSystem(vertical: VerticalConfig, issueNotes: string[]): string {
  const issuesBlock = issueNotes.length
    ? `\n\nПЕРЕВІР непевні дані (постав МАКСИМУМ ОДНЕ м'яке підтверджувальне питання за хід, природним відлунням, без жаргону):\n${issueNotes.map((n) => `- ${n}`).join("\n")}`
    : "";

  return `Ти — досвідчений консультант, що допомагає власнику бізнесу зробити сайт. Ти не просто збираєш дані — ти РАДИШ простою мовою, що корисно вказати на сайті саме для його ніші. Людина часто не знає, що писати — м'яко підказуй їй.

Тип бізнесу (визначено з розмови): ${vertical.label} — ${vertical.personaHint}.
Порада для цієї ніші: ${vertical.advisorGuidance}

Факти, без яких сайт не вийде (це проста розмова, НЕ анкета). Список — МІНІМУМ, не стеля: все, що підніме якість сайту, вартує питання:
${fieldList(vertical)}

ЯК ВІДПОВІДАТИ:
- Пиши користувачу звичайним теплим текстом українською. Списки — звичайними переносами рядків. НЕ пиши JSON і НЕ екрануй символи.
- Розмітка: можна виділити найважливіше **жирним**. ЖОДНОЇ іншої markdown-розмітки (без #, таблиць, нумерованих списків).
- Поки триває збір (status "collecting"), КОЖНА відповідь закінчується ОДНИМ конкретним питанням до користувача. Ніколи не пиши мета-фрази («зберігаю дані», «питаю далі», «продовжимо») замість питання — одразу став саме питання.
- ПІСЛЯ тексту ЗАВЖДИ виклич інструмент save_facts зі структурованими даними (verticalId, factsPatch, status).

ПРАВИЛА РОЗМОВИ:
- Тривіальне групуй ("назва, місто і телефон — одним повідомленням"). Складні питання — строго ПО ОДНОМУ.
- ПРОСТОТА: кожне питання — одна проста думка, побутовою мовою, без термінів. Ніколи не став два складні питання в одному повідомленні.
- ТЕМП КОРИСТУВАЧА: короткі чи нетерплячі відповіді, або «просто згенеруй» — не тягни, одразу веди до status "ready". Твої питання — можливість для користувача, не обовʼязок.
- З кожного повідомлення витягуй у factsPatch лише НОВІ/змінені поля. last-wins при виправленні.
- Ти БІЗНЕС-АНАЛІТИК + ПОРАДНИК: проактивно пропонуй, що варто додати (послуги з орієнтовними цінами, години, як замовити/звернутися, відгуки). Якщо людина не знає — запропонуй конкретне й типове для її ніші, коротко.
- ЦІНИ ПОСЛУГ: якщо користувач назвав послуги, але БЕЗ цін — обовʼязково постав ОДНЕ просте питання: «Назвіть орієнтовні ціни хоча б для головних послуг — можна "від"». Не допитуйся ціни кожної позиції; що дали — те збережи. Відмовився чи не знає — не наполягай, сайт буде без цін.
- ЛОГО І ФОТО: у природний момент розмови постав два ПРОСТІ питання (окремо, не в одному повідомленні): «Чи маєте логотип?» та «Чи є фото ваших робіт чи закладу?» (quickReplies: «Так» / «Ні» / «Немає, але хочу»). Відповіді пиши у factsPatch: hasLogo, hasPhotos (true/false; «немає, але хочу» = false). Є лого чи фото → скажи, що попросиш завантажити їх перед створенням сайту. Нема лого → заспокой: шапка сайту гарно працює і з текстовою назвою. Нема фото → чесно попередь, що створиш атмосферне зображення (не фото їхнього закладу), і коротко порадь, які 2–3 фото варто зробити пізніше — типові для цієї ніші.
- Уточнюй нішеві деталі (напр. для юриста — спеціалізацію) перш ніж радити далі.
- КОЛИ базові факти (назва, місто, телефон) зібрано — став ПОГЛИБЛЮВАЛЬНІ питання порадника, ПО ОДНОМУ за хід: чим ви відрізняєтесь від інших у місті (відповідь вплети в поле about), скільки років працюєте, як клієнти зазвичай замовляють. Кількість таких питань визначаєш ТИ: якщо ще одне-два питання помітно піднімуть якість сайту — питай. Орієнтир — цінність для сайту, не чек-лист. Коли нового по суті не додається — веди до status "ready".
- НЕ вигадуй фактів за користувача.
- status "ready" — лише коли зібрано достатньо для ЯКІСНОГО сайту, АБО користувач явно каже "просто згенеруй".
- ЗАЛІЗНЕ ПРАВИЛО: поки status "collecting", остання фраза твого тексту — конкретне питання зі знаком «?». Без винятків.
- quickReplies: коли на твоє питання є очевидні варіанти (тип бізнесу, так/ні, «Пропустити») — дай 2–4 коротких чипи (1–4 слова). Коли відповідь вільна (назва, телефон, адреса) — НЕ давай.

МЕЖІ ПЛАТФОРМИ (чесність понад усе):
- Ми вміємо: односторінковий сайт із готових блоків (шапка, послуги з цінами, фото-галерея, відгуки, FAQ, контакти, форма заявки, що приходить власнику в Telegram), зміна кольорової теми, просте редагування текстів (у т.ч. з ШІ).
- Ми НЕ вміємо: інтернет-магазин / кошик / оплату на сайті, онлайн-запис із календарем, особисті кабінети, інтеграції (CRM, 1C тощо), довільний дизайн чи власний код, багатосторінкові сайти.
- Якщо користувач просить те, чого ми не вміємо: чесно й тепло скажи, що наша платформа проста й недорога, і цього в ній немає — НЕ обіцяй і не вигадуй. Додай: якщо це важливо, після створення сайту в редакторі є кнопка «Хочу кастомні зміни» — опишіть там завдання, і ми оцінимо та зробимо індивідуально. Після відмови повернись до збору фактів для сайту.
- Це стосується лише справді неможливого. Тексти, послуги, ціни, фото, кольори, порядок секцій — наша звичайна робота, таке НЕ відхиляй.${issuesBlock}`;
}

function sanitize(msg: string): string {
  // Defensive: drop broken-UTF8 replacement chars; convert any literal "\n".
  return msg.replace(/�/g, "").replace(/\\n/g, "\n").trim();
}

// ---------------------------------------------------------------------------
// Shared core for the two entry points: the legacy non-stream turn (fallback)
// and the streaming route handler (app/api/onboard). Both must build the SAME
// call and parse the SAME final message.
// ---------------------------------------------------------------------------

export interface OnboardCall {
  system: string;
  messages: Anthropic.MessageParam[];
  vertical: VerticalConfig;
}

/** Build system+messages for a turn; null = nothing to answer (no user msg yet). */
export function prepareOnboardCall(
  history: ChatMsg[],
  currentFacts: Partial<BusinessFacts>,
  currentVerticalId?: string,
): OnboardCall | null {
  const vertical = getVertical(currentVerticalId);
  const issues = validateFacts(currentFacts, vertical);

  const all: Anthropic.MessageParam[] = history.map((m) => ({ role: m.role, content: m.content }));
  const firstUser = all.findIndex((m) => m.role === "user");
  const messages = firstUser >= 0 ? all.slice(firstUser) : all;
  if (messages.length === 0) return null;

  const system = `${buildSystem(vertical, issues.map((i) => i.note))}\n\nПоточні зібрані факти (JSON): ${JSON.stringify(currentFacts)}`;
  return { system, messages, vertical };
}

export interface ParsedOnboardMessage {
  message: string;
  facts: Partial<BusinessFacts>;
  verticalId: string;
  ready: boolean;
  quickReplies: string[];
}

/** Extract text + save_facts payload from a completed model message. */
export function parseOnboardMessage(
  res: Anthropic.Message,
  baseFacts: Partial<BusinessFacts>,
  baseVerticalId: string,
): ParsedOnboardMessage {
  const textMsg = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  let facts: Partial<BusinessFacts> = baseFacts;
  let verticalId = baseVerticalId;
  let ready = false;
  let quickReplies: string[] = [];

  const toolUse = res.content.find((b) => b.type === "tool_use");
  if (toolUse && toolUse.type === "tool_use") {
    const parsed = saveFactsSchema.safeParse(toolUse.input);
    if (parsed.success) {
      facts = { ...baseFacts, ...parsed.data.factsPatch };
      verticalId = VERTICAL_IDS.includes(parsed.data.verticalId) ? parsed.data.verticalId : baseVerticalId;
      ready = parsed.data.status === "ready";
      quickReplies = (parsed.data.quickReplies ?? []).map((q) => q.trim()).filter(Boolean).slice(0, 4);
    }
  }

  const message = sanitize(textMsg) || "Розкажіть, будь ласка, ще трохи про ваш бізнес?";
  return { message, facts, verticalId, ready, quickReplies };
}

export { saveFactsTool, computeProgress };

/**
 * Deterministic follow-up for a collecting turn that arrived without a
 * question (streaming path can't do the corrective retry the non-stream turn
 * does). Zero extra tokens: ask for the first still-missing key fact.
 */
export function fallbackQuestion(facts: Partial<BusinessFacts>): string {
  const missing = (k: keyof BusinessFacts) => {
    const v = facts[k];
    return v == null || String(v).trim().length === 0;
  };
  if (missing("businessName")) return "Як називається ваш бізнес?";
  if (missing("city")) return "У якому місті ви працюєте?";
  if (missing("phone")) return "Який телефон для звʼязку з клієнтами?";
  if (missing("address")) return "За якою адресою вас знайти?";
  if (missing("hours")) return "Які у вас години роботи?";
  return "Додати щось іще — чи натиснемо «Переглянути й створити сайт»?";
}

export async function onboardTurn(
  history: ChatMsg[],
  currentFacts: Partial<BusinessFacts>,
  currentVerticalId?: string,
): Promise<OnboardTurnResult> {
  const client = getAnthropic();

  // Vertical guidance comes from the MODEL's own classification, threaded from
  // the previous turn (generic until it decides).
  const call = prepareOnboardCall(history, currentFacts, currentVerticalId);
  if (!call) {
    return {
      message: "Розкажіть трохи про ваш бізнес — що це за справа, у якому місті, і який телефон?",
      facts: currentFacts,
      verticalId: getVertical(currentVerticalId).id,
      ready: false,
      quickReplies: [],
      progress: computeProgress(currentFacts),
    };
  }
  const { system, messages, vertical } = call;

  const ask = (msgs: Anthropic.MessageParam[]) =>
    client.messages.create({
      model: CHAT_MODEL,
      max_tokens: 3000,
      system,
      tools: [saveFactsTool],
      tool_choice: { type: "auto" },
      messages: msgs,
    });

  const parse = parseOnboardMessage;

  let out = parse(await ask(messages), currentFacts, vertical.id);

  // Guard: a collecting turn that ends without a question stalls the funnel —
  // the model occasionally narrates («зберігаю дані й питаю далі») instead of
  // asking. One corrective retry; its factsPatch lands on top of the first one.
  if (!out.ready && !out.message.includes("?")) {
    const retry = parse(
      await ask([
        ...messages,
        { role: "assistant", content: out.message },
        {
          role: "user",
          content:
            "(службова примітка, не від користувача: у відповіді вище немає питання — постав зараз ОДНЕ конкретне наступне питання і виклич save_facts)",
        },
      ]),
      out.facts,
      out.verticalId,
    );
    if (retry.message.includes("?")) out = retry;
  }

  return { ...out, progress: computeProgress(out.facts) };
}
