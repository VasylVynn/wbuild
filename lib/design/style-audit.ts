import "server-only";
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, GEN_MODEL } from "@/lib/ai/anthropic";
import { stripLoneSurrogates } from "@/lib/ai/sanitize";
import { lintWireCss } from "@/lib/design/css-lint";
import { fixContrast } from "@/lib/design/css-contrast";
import { generateWireStyle } from "@/lib/design/wire-style";
import type { StyleAuditReport } from "@/lib/site/page-content";

/**
 * The style QA gate (spec 2026-07-28): deterministic lint + contrast first,
 * then ONE bounded model verdict on gross aesthetics. A failing verdict spends
 * the single regen budget — generateWireStyle re-run with the corrective note
 * appended to the brief, same hue — and the regenerated sheet is re-linted and
 * re-judged. Still failing → the sheet with fewer deterministic violations
 * ships (tie → the original) and the report is flagged for the admin QA column.
 * Fail-open throughout: any error keeps the current css and never throws.
 */

const verdictSchema = z.object({
  verdict: z.enum(["pass", "fail"]),
  note: z
    .string()
    .describe("Якщо fail — одне коротке конкретне зауваження українською, ЩО саме зламано")
    .optional(),
});

const verdictTool = {
  name: "report_style_verdict",
  description: "Повернути вердикт про якість стилю.",
  input_schema: z.toJSONSchema(verdictSchema),
} as unknown as Anthropic.Tool;

async function auditStyleWithModel(
  css: string,
  sectionDigest: string,
): Promise<{ verdict: "pass" | "fail"; note?: string }> {
  const client = getAnthropic();
  const res = await client.messages.create({
    model: GEN_MODEL,
    max_tokens: 500,
    thinking: { type: "disabled" },
    output_config: { effort: "low" },
    system: `Ти — арт-директор, який приймає згенерований дизайн сайту малого українського бізнесу. Тобі дано стильовий CSS сайту і текст його секцій. Оціни ЛИШЕ грубі дефекти, НЕ смакові нюанси:
- кислотні або конфліктні кольори, які б'ють по очах;
- нечитабельні комбінації (текст майже зливається з фоном);
- хаос: кілька несумісних дизайн-ідей упереміш, відсутність будь-якої ієрархії;
- стиль, що явно суперечить типу бізнесу (похмурий морок для дитячої студії).
Нормальний, хай і не геніальний, дизайн = pass. Сумніваєшся — pass.
Виклич report_style_verdict; на fail додай note — одне конкретне зауваження українською (його передадуть дизайнеру як правку).`,
    tools: [verdictTool],
    tool_choice: { type: "tool", name: "report_style_verdict" },
    messages: [
      {
        role: "user",
        content: stripLoneSurrogates(`СЕКЦІЇ САЙТУ (видимий текст):
${sectionDigest}

СТИЛЬОВИЙ CSS:
\`\`\`css
${css.slice(0, 80000)}
\`\`\`

Виклич report_style_verdict.`),
      },
    ],
  });
  const toolUse = res.content.find((b) => b.type === "tool_use");
  const parsed = toolUse?.type === "tool_use" ? verdictSchema.safeParse(toolUse.input) : undefined;
  if (!parsed?.success) return { verdict: "pass" }; // unparseable → fail-open
  return { verdict: parsed.data.verdict, note: parsed.data.note };
}

export async function runStyleAudit(opts: {
  css: string | undefined;
  sectionDigest: string;
  brief: string;
  hue: number;
}): Promise<{ css: string | undefined; report: StyleAuditReport }> {
  const report: StyleAuditReport = {
    lintViolations: [],
    contrastFixes: [],
    verdict: "pass",
    regenerated: false,
    flagged: false,
    checkedAt: new Date().toISOString(),
  };
  if (!opts.css) return { css: opts.css, report }; // grey wireframe — nothing to audit

  // Phase 1: deterministic, always.
  const lint = lintWireCss(opts.css);
  const contrast = fixContrast(lint.cleanCss);
  report.lintViolations = lint.violations;
  report.contrastFixes = contrast.fixes;
  let css = contrast.css;

  // Phase 2: one bounded verdict; fail → one regen, re-lint, re-judge.
  try {
    const first = await auditStyleWithModel(css, opts.sectionDigest);
    report.verdict = first.verdict;
    report.correctiveNote = first.note;
    if (first.verdict === "fail") {
      report.regenerated = true;
      const correctedBrief = `${opts.brief}\nПопередня версія стилю мала ваду — обов'язково уникни її: ${first.note ?? "нечитабельний, конфліктний стиль"}.`;
      const regen = await generateWireStyle(correctedBrief, { hue: opts.hue });
      const relint = lintWireCss(regen.css);
      const recontrast = fixContrast(relint.cleanCss);
      const second = await auditStyleWithModel(recontrast.css, opts.sectionDigest);
      const regenDetIssues = relint.violations.length;
      const origDetIssues = report.lintViolations.length;
      if (second.verdict === "pass" || regenDetIssues < origDetIssues) {
        css = recontrast.css;
        report.lintViolations = relint.violations;
        report.contrastFixes = recontrast.fixes;
        report.verdict = second.verdict;
        report.correctiveNote = second.note;
      }
    }
  } catch (e) {
    console.warn(`[style-audit] model phase failed (fail-open): ${e instanceof Error ? e.message : e}`);
  }
  // Unconditional (plan-review must-fix): a crash mid-regen aborts the block
  // above — a failing verdict must still surface in the admin QA column.
  report.flagged = report.verdict === "fail";

  return { css, report };
}
