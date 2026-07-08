import "server-only";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, CHAT_MODEL } from "./anthropic";
import { blockSchemas, isBlockType, type BlockType } from "@/lib/blocks/schema";
import { getVertical } from "@/lib/verticals/registry";
import type { BusinessFacts } from "@/lib/verticals/schema";

/**
 * Block-level AI edit (current-cycle п.1, «Відредагувати з ШІ»): the owner
 * writes a plain instruction («зроби текст теплішим») and the model rewrites
 * ONLY this block's props. Safety = the same rails as generation: the tool
 * schema is THIS block's Zod schema, output is re-validated, grounding forbids
 * inventing facts, and the result lands in the DRAFT form for the human to
 * review and save (§3 — AI fills the form, the person confirms).
 */
export async function aiEditBlock(input: {
  type: string;
  props: unknown;
  instruction: string;
  facts: Partial<BusinessFacts>;
  verticalId?: string;
}): Promise<{ ok: true; props: unknown } | { ok: false; error: string }> {
  if (!isBlockType(input.type)) return { ok: false, error: `Unknown block type: ${input.type}` };
  const type = input.type as BlockType;
  const schema = blockSchemas[type];
  const vertical = getVertical(input.verticalId);

  const client = getAnthropic();
  const editTool = {
    name: "apply_edit",
    description: "Застосувати відредагований вміст блоку.",
    input_schema: z.toJSONSchema(z.object({ props: schema })),
  } as unknown as Anthropic.Tool;

  const system = `Ти — редактор вмісту ОДНОГО блоку сайту українського бізнесу (${vertical.label}).
Тобі дано поточний вміст блоку і інструкцію власника. Зміни вміст ЗА ІНСТРУКЦІЄЮ — і більше нічого.

ПРАВИЛА:
- Змінюй лише те, про що просить інструкція; решту полів залишай як є (скопіюй без змін).
- ФАКТИ (телефон, адреса, години, ціни, назви послуг, тексти відгуків) — НЕ вигадуй і не змінюй, якщо інструкція прямо цього не просить; нові факти бери ЛИШЕ з наданих даних бізнесу.
- Не вигадуй URL зображень; наявні imageUrl/url залишай без змін.
- Пиши живою українською, тепло і по суті. Виклич інструмент apply_edit з повним оновленим props.`;

  const user = `Тип блоку: ${type}
Поточний вміст (JSON):
${JSON.stringify(input.props, null, 2)}

Дані бізнесу (для grounding):
${JSON.stringify(input.facts ?? {}, null, 2)}

Інструкція власника: «${input.instruction.trim().slice(0, 500)}»`;

  let lastError = "no tool call";
  for (let attempt = 0; attempt < 2; attempt++) {
    const messages: Anthropic.MessageParam[] =
      attempt === 0
        ? [{ role: "user", content: user }]
        : [
            { role: "user", content: user },
            { role: "user", content: `Попередній результат не пройшов схему: ${lastError}. Виправ і виклич apply_edit ще раз.` },
          ];
    const res = await client.messages.create({
      model: CHAT_MODEL,
      max_tokens: 4000,
      system,
      tools: [editTool],
      tool_choice: { type: "tool", name: "apply_edit" },
      messages,
    });
    const tu = res.content.find((b) => b.type === "tool_use");
    if (!tu || tu.type !== "tool_use") {
      lastError = `stop_reason=${res.stop_reason}`;
      continue;
    }
    const parsed = z.object({ props: schema }).safeParse(tu.input);
    if (parsed.success) return { ok: true, props: parsed.data.props };
    lastError = parsed.error.issues.slice(0, 4).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
  }
  return { ok: false, error: `Не вдалося застосувати правку: ${lastError}` };
}
