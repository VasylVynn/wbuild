import "server-only";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, CHAT_MODEL } from "./anthropic";
import {
  floristFactsSchema,
  floristRequiredFields,
  floristFieldMeta,
  type FloristFacts,
} from "@/lib/verticals/florist";

/**
 * Onboarding slot-filling agent (brief §4.9). The chat is ONLY the interface;
 * the source of truth is a structured facts object per the vertical field-schema.
 * Each turn the model extracts facts from the latest user message, replies
 * warmly (batched questions, not 15 one-by-one), and signals readiness. "Enough
 * info" = required fields filled (computed in code, not trusted to the model).
 * Generation runs from the CONFIRMED facts, never the transcript.
 */

export type ChatMsg = { role: "user" | "assistant"; content: string };

const factsPatchSchema = floristFactsSchema.partial();

const respondTool = {
  name: "respond",
  description: "Оновити зібрані факти й відповісти користувачу однією реплікою.",
  input_schema: z.toJSONSchema(
    z.object({
      factsPatch: factsPatchSchema.describe(
        "Факти, витягнуті З ОСТАННЬОГО повідомлення користувача — лише нові або змінені поля; масиви передавай цілком.",
      ),
      message: z
        .string()
        .describe("Тепла коротка відповідь українською: підтвердь почуте й запитай наступне батчем."),
      status: z
        .enum(["collecting", "ready"])
        .describe("ready — коли зібрано достатньо або користувач попросив 'просто згенеруй'."),
    }),
  ),
} as unknown as Anthropic.Tool;

const turnOutputSchema = z.object({
  factsPatch: factsPatchSchema,
  message: z.string(),
  status: z.enum(["collecting", "ready"]),
});

export function requiredFilled(facts: Partial<FloristFacts>): boolean {
  return floristRequiredFields.every((f) => {
    const v = facts[f];
    return v !== undefined && v !== null && String(v).trim().length > 0;
  });
}

function fieldList(): string {
  return (Object.keys(floristFieldMeta) as (keyof FloristFacts)[])
    .map((k) => {
      const meta = floristFieldMeta[k];
      const req = floristRequiredFields.includes(k) ? " (обов'язкове)" : "";
      return `- ${String(k)}: ${meta.label}${req}`;
    })
    .join("\n");
}

const SYSTEM = `Ти — привітний помічник, який допомагає власнику квіткового бізнесу зробити сайт. Спілкуйся тепло, просто, живою українською — як з людиною, що не любить технічних форм.

ТВОЯ МЕТА: у розмові зібрати факти про бізнес (нижче), щоб згенерувати сайт. Це НЕ анкета — це розмова.

ПОЛЯ, які треба зібрати:
${fieldList()}

ПРАВИЛА:
- Питай БАТЧАМИ, не по одному питанню × 15. Тривіальне групуй ("назва, місто і телефон — одним повідомленням").
- З КОЖНОГО повідомлення користувача витягуй факти у factsPatch (лише нові/змінені поля).
- last-wins: якщо користувач виправляє ("ой, телефон інший") — онови це поле.
- Коли обов'язкові поля (назва, місто, телефон) зібрані — став status "ready", але привітно запропонуй додати послуги, години, відгуки, якщо він хоче.
- Ескейп-хетч: якщо користувач каже "просто згенеруй" / "давай вже" — став status "ready" одразу, з тим що є.
- НЕ вигадуй фактів за користувача. Порожній factsPatch — нормально.
- ЩОРАЗУ викликай інструмент respond.`;

export interface OnboardTurnResult {
  message: string;
  facts: Partial<FloristFacts>;
  ready: boolean;
}

export async function onboardTurn(
  history: ChatMsg[],
  currentFacts: Partial<FloristFacts>,
): Promise<OnboardTurnResult> {
  const client = getAnthropic();

  // Messages must start with a user turn — a UI greeting is assistant-first, so
  // trim to the first user message.
  const all: Anthropic.MessageParam[] = history.map((m) => ({ role: m.role, content: m.content }));
  const firstUser = all.findIndex((m) => m.role === "user");
  const messages = firstUser >= 0 ? all.slice(firstUser) : all;
  if (messages.length === 0) {
    return { message: "Розкажіть трохи про ваш бізнес — як називається і в якому місті?", facts: currentFacts, ready: false };
  }

  const res = await client.messages.create({
    model: CHAT_MODEL,
    max_tokens: 2000,
    system: `${SYSTEM}\n\nПоточні зібрані факти (JSON): ${JSON.stringify(currentFacts)}`,
    tools: [respondTool],
    tool_choice: { type: "tool", name: "respond" },
    messages,
  });

  const tu = res.content.find((b) => b.type === "tool_use");
  if (!tu || tu.type !== "tool_use") {
    return { message: "Вибачте, повторіть, будь ласка?", facts: currentFacts, ready: requiredFilled(currentFacts) };
  }
  const parsed = turnOutputSchema.safeParse(tu.input);
  if (!parsed.success) {
    return { message: "Розкажіть ще трохи про свій бізнес?", facts: currentFacts, ready: requiredFilled(currentFacts) };
  }

  const merged: Partial<FloristFacts> = { ...currentFacts, ...parsed.data.factsPatch };
  const ready = parsed.data.status === "ready" || requiredFilled(merged);
  return { message: parsed.data.message, facts: merged, ready };
}
