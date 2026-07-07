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
 * interface; the source of truth is a structured facts object. Beyond
 * slot-filling, the agent is a DOMAIN ADVISOR: it classifies the vertical from
 * the conversation, uses that vertical's guidance to proactively (and simply)
 * suggest what belongs on the site, asks niche-specific clarifying questions,
 * and VALIDATES facts (deterministic validators emit issues → one gentle
 * confirming question per turn). Generation runs from the CONFIRMED facts.
 */

export type ChatMsg = { role: "user" | "assistant"; content: string };

const factsPatchSchema = businessFactsSchema.partial();

const turnOutputSchema = z.object({
  verticalId: z.enum(VERTICAL_IDS as [string, ...string[]]),
  factsPatch: factsPatchSchema,
  message: z.string(),
  status: z.enum(["collecting", "ready"]),
});

const respondTool = {
  name: "respond",
  description: "Оновити зібрані факти, визначити тип бізнесу й відповісти користувачу.",
  input_schema: z.toJSONSchema(
    z.object({
      verticalId: z
        .enum(VERTICAL_IDS as [string, ...string[]])
        .describe("Твоя оцінка типу бізнесу зі списку; generic, якщо не підходить жоден."),
      factsPatch: factsPatchSchema.describe(
        "Факти з ОСТАННЬОГО повідомлення користувача — лише нові/змінені поля; масиви цілком.",
      ),
      message: z.string().describe("Тепла коротка відповідь українською — підтверджує/радить/питає далі."),
      status: z.enum(["collecting", "ready"]).describe(
        "ready — лише коли зібрано достатньо для ЯКІСНОГО сайту, АБО користувач попросив 'просто згенеруй'.",
      ),
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

ПРАВИЛА:
- Питай БАТЧАМИ, тривіальне групуй ("назва, місто і телефон — одним повідомленням").
- З кожного повідомлення витягуй факти у factsPatch (лише нові/змінені поля). last-wins при виправленні.
- Ти БІЗНЕС-АНАЛІТИК + ПОРАДНИК: проактивно пропонуй, що варто додати (послуги з орієнтовними цінами, години, як замовити/звернутися, відгуки). Якщо людина не знає — запропонуй конкретне й типове для її ніші, коротко.
- Уточнюй нішеві деталі (напр. для юриста — спеціалізацію) перш ніж радити далі.
- НЕ вигадуй фактів за користувача. Порожній factsPatch — нормально. verticalId — твоя оцінка типу бізнесу.
- status "ready" — лише коли зібрано достатньо для ЯКІСНОГО сайту (не просто 3 поля), АБО користувач явно каже "просто згенеруй". Не зупиняйся на мінімумі, але й не допитуй нескінченно.
- ЩОРАЗУ викликай інструмент respond.${issuesBlock}`;
}

export async function onboardTurn(
  history: ChatMsg[],
  currentFacts: Partial<BusinessFacts>,
  currentVerticalId?: string,
): Promise<OnboardTurnResult> {
  const client = getAnthropic();

  // Vertical guidance comes from the MODEL's own classification, threaded from
  // the previous turn (generic until it decides). Avoids naive keyword misfires
  // like matching "квіт" inside "не квіткарня".
  const vertical = getVertical(currentVerticalId);

  // Deterministic validation of already-collected facts → issues the agent
  // must confirm (grounding protects against model fabrication, not user garbage).
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
    max_tokens: 2000,
    system: `${buildSystem(vertical, issues.map((i) => i.note))}\n\nПоточні зібрані факти (JSON): ${JSON.stringify(currentFacts)}`,
    tools: [respondTool],
    tool_choice: { type: "tool", name: "respond" },
    messages,
  });

  const tu = res.content.find((b) => b.type === "tool_use");
  if (!tu || tu.type !== "tool_use") {
    return { message: "Вибачте, повторіть, будь ласка?", facts: currentFacts, verticalId: vertical.id, ready: false };
  }
  const parsed = turnOutputSchema.safeParse(tu.input);
  if (!parsed.success) {
    return { message: "Розкажіть ще трохи про свій бізнес?", facts: currentFacts, verticalId: vertical.id, ready: false };
  }

  const merged: Partial<BusinessFacts> = { ...currentFacts, ...parsed.data.factsPatch };
  const verticalId = VERTICAL_IDS.includes(parsed.data.verticalId) ? parsed.data.verticalId : vertical.id;
  // ready is the model's decision ONLY (fixes the old `|| requiredFilled` bug
  // that auto-stopped collection the instant 3 fields were present). The
  // confirmation form still enforces required fields before generation.
  return { message: parsed.data.message, facts: merged, verticalId, ready: parsed.data.status === "ready" };
}
