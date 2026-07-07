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
    }),
  ),
} as unknown as Anthropic.Tool;

export interface OnboardTurnResult {
  message: string;
  facts: Partial<BusinessFacts>;
  verticalId: string;
  ready: boolean;
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

Факти, які варто зібрати (це проста розмова, НЕ анкета):
${fieldList(vertical)}

ЯК ВІДПОВІДАТИ:
- Пиши користувачу звичайним теплим текстом українською. Списки — звичайними переносами рядків. НЕ пиши JSON і НЕ екрануй символи.
- ПІСЛЯ тексту ЗАВЖДИ виклич інструмент save_facts зі структурованими даними (verticalId, factsPatch, status).

ПРАВИЛА РОЗМОВИ:
- Питай БАТЧАМИ, тривіальне групуй ("назва, місто і телефон — одним повідомленням").
- З кожного повідомлення витягуй у factsPatch лише НОВІ/змінені поля. last-wins при виправленні.
- Ти БІЗНЕС-АНАЛІТИК + ПОРАДНИК: проактивно пропонуй, що варто додати (послуги з орієнтовними цінами, години, як замовити/звернутися, відгуки). Якщо людина не знає — запропонуй конкретне й типове для її ніші, коротко.
- Уточнюй нішеві деталі (напр. для юриста — спеціалізацію) перш ніж радити далі.
- НЕ вигадуй фактів за користувача.
- status "ready" — лише коли зібрано достатньо для ЯКІСНОГО сайту, АБО користувач явно каже "просто згенеруй".${issuesBlock}`;
}

function sanitize(msg: string): string {
  // Defensive: drop broken-UTF8 replacement chars; convert any literal "\n".
  return msg.replace(/�/g, "").replace(/\\n/g, "\n").trim();
}

export async function onboardTurn(
  history: ChatMsg[],
  currentFacts: Partial<BusinessFacts>,
  currentVerticalId?: string,
): Promise<OnboardTurnResult> {
  const client = getAnthropic();

  // Vertical guidance comes from the MODEL's own classification, threaded from
  // the previous turn (generic until it decides).
  const vertical = getVertical(currentVerticalId);
  const issues = validateFacts(currentFacts, vertical);

  const all: Anthropic.MessageParam[] = history.map((m) => ({ role: m.role, content: m.content }));
  const firstUser = all.findIndex((m) => m.role === "user");
  const messages = firstUser >= 0 ? all.slice(firstUser) : all;
  if (messages.length === 0) {
    return {
      message: "Розкажіть трохи про ваш бізнес — що це за справа, у якому місті, і який телефон?",
      facts: currentFacts,
      verticalId: vertical.id,
      ready: false,
    };
  }

  const res = await client.messages.create({
    model: CHAT_MODEL,
    max_tokens: 3000,
    system: `${buildSystem(vertical, issues.map((i) => i.note))}\n\nПоточні зібрані факти (JSON): ${JSON.stringify(currentFacts)}`,
    tools: [saveFactsTool],
    tool_choice: { type: "auto" },
    messages,
  });

  const textMsg = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  let facts: Partial<BusinessFacts> = currentFacts;
  let verticalId = vertical.id;
  let ready = false;

  const toolUse = res.content.find((b) => b.type === "tool_use");
  if (toolUse && toolUse.type === "tool_use") {
    const parsed = saveFactsSchema.safeParse(toolUse.input);
    if (parsed.success) {
      facts = { ...currentFacts, ...parsed.data.factsPatch };
      verticalId = VERTICAL_IDS.includes(parsed.data.verticalId) ? parsed.data.verticalId : vertical.id;
      ready = parsed.data.status === "ready";
    }
  }

  const message = sanitize(textMsg) || "Розкажіть, будь ласка, ще трохи про ваш бізнес?";
  return { message, facts, verticalId, ready };
}
