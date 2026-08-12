import "server-only";
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, GEN_MODEL } from "@/lib/ai/anthropic";
import { stripLoneSurrogates } from "@/lib/ai/sanitize";
import { lintWireCss } from "@/lib/design/css-lint";
import { fixContrast } from "@/lib/design/css-contrast";
import { clampCss, CSS_SIZE_LIMIT } from "@/lib/design/css-size";
import { generateWireStyle, designSpecStyleLines } from "@/lib/design/wire-style";
import type { DesignSpec } from "@/lib/site/design-spec";
import type { StyleAuditReport } from "@/lib/site/page-content";

/**
 * The style QA gate (spec 2026-07-28): deterministic lint + contrast first,
 * then ONE bounded model verdict on gross aesthetics. A failing verdict spends
 * the single regen budget — generateWireStyle re-run with the corrective note
 * appended to the brief and, when the caller supplies one, a DIFFERENT hue —
 * and the regenerated sheet is re-linted and re-judged. Re-rolling the hue
 * matters because a rejected sheet is often rejected FOR its colour, and the
 * same anchor plus one corrective sentence tends to reproduce it.
 * Still failing → the sheet with fewer deterministic violations
 * ships (tie → the original) and the report is flagged for the admin QA column.
 * Fail-open throughout: any error keeps the current css and never throws.
 *
 * v2 (spec §3-S4): when the generation carried a designSpec, the same verdict
 * call ALSO judges brief adherence (palette roles / typography character /
 * motion level) — advisory, recorded in the report, never a fail on its own.
 */

const verdictSchema = z.object({
  verdict: z.enum(["pass", "fail"]),
  note: z
    .string()
    .describe("Якщо fail — одне коротке конкретне зауваження українською, ЩО саме зламано")
    .optional(),
  adherence: z
    .object({
      palette: z.boolean().describe("Кольоровий світ брифу впізнаваний у CSS"),
      typography: z.boolean().describe("Характер заявленої шрифтової пари передано вагою/трекінгом"),
      motion: z.boolean().describe("Обсяг transition/@keyframes правдоподібний для заявленого рівня"),
      note: z.string().describe("Одне коротке пояснення українською, ЩО розійшлося").optional(),
    })
    .describe("Заповнюй ЛИШЕ коли в повідомленні є дизайн-бриф")
    .optional(),
});

const verdictTool = {
  name: "report_style_verdict",
  description: "Повернути вердикт про якість стилю.",
  input_schema: z.toJSONSchema(verdictSchema),
} as unknown as Anthropic.Tool;

/** The adherence lens, appended to the SYSTEM prompt only when a designSpec
 *  exists. Tolerance is explicit: deterministic repairs (fixContrast) may have
 *  legitimately moved colors off the brief's exact hexes — adherence judges
 *  whether the brief's WORLD is recognisable, not hex equality. */
const ADHERENCE_SYSTEM = `

Додатково: у повідомленні є ДИЗАЙН-БРИФ цього сайту. Оціни в adherence, чи CSS йому слідує:
- palette: чи кольоровий світ брифу (ролі тла/поверхні/тексту/акценту) впізнаваний. Кодовий ремонт контрасту міг ЛЕГІТИМНО посунути відтінки від точних hex — не карай за зсув тону, лише за інший кольоровий світ.
- typography: чи передано характер заявленої пари вагою, розміром, letter-spacing (font-family пише код — його відсутність не порушення).
- motion: чи обсяг transition/hover/@keyframes правдоподібний для заявленого рівня (0 — статика, 3 — виразний рух).
adherence — окрема діагностика: НЕ провалюй verdict через саму лише розбіжність із брифом.`;

async function auditStyleWithModel(
  css: string,
  sectionDigest: string,
  designSpec: DesignSpec | undefined,
  signal?: AbortSignal,
): Promise<{
  verdict: "pass" | "fail";
  note?: string;
  adherence?: StyleAuditReport["adherence"];
}> {
  const client = getAnthropic();
  const briefBlock = designSpec
    ? `\nДИЗАЙН-БРИФ (якого мав слідувати цей CSS):${designSpecStyleLines(designSpec)}\n`
    : "";
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
Виклич report_style_verdict; на fail додай note — одне конкретне зауваження українською (його передадуть дизайнеру як правку).${designSpec ? ADHERENCE_SYSTEM : ""}`,
    tools: [verdictTool],
    tool_choice: { type: "tool", name: "report_style_verdict" },
    messages: [
      {
        role: "user",
        content: stripLoneSurrogates(`СЕКЦІЇ САЙТУ (видимий текст):
${sectionDigest}
${briefBlock}
СТИЛЬОВИЙ CSS:
\`\`\`css
${css.slice(0, CSS_SIZE_LIMIT)}
\`\`\`

Виклич report_style_verdict.`),
      },
    ],
  }, { signal });
  const toolUse = res.content.find((b) => b.type === "tool_use");
  const parsed = toolUse?.type === "tool_use" ? verdictSchema.safeParse(toolUse.input) : undefined;
  if (!parsed?.success) return { verdict: "pass" }; // unparseable → fail-open
  return {
    verdict: parsed.data.verdict,
    note: parsed.data.note,
    // Only meaningful against a brief — an uninvited judgement is dropped.
    adherence: designSpec ? parsed.data.adherence : undefined,
  };
}

export async function runStyleAudit(opts: {
  css: string | undefined;
  sectionDigest: string;
  brief: string;
  hue: number;
  /**
   * Hue for the ONE regeneration a failing verdict buys. The caller supplies a
   * fresh roll for the same vertical (`hueForVertical` with the next nonce), so
   * the retry starts from a different colour world instead of re-deriving the
   * one the art director just rejected. Omitted → the retry reuses `hue`.
   */
  altHue?: number;
  /**
   * The S1 design brief this stylesheet answers to (pipeline v2 §3-S4): the
   * verdict call also judges brief ADHERENCE (recorded, advisory), and a
   * corrective regen re-asserts the palette-role ANCHORS (designSpec supersedes
   * the hue inside generateWireStyle) instead of rolling a bare altHue — and
   * keeps fonts/motion out of the CSS, since the renderer owns them now.
   * Absent → exactly the v1 altHue retry, no adherence.
   */
  designSpec?: DesignSpec;
  /**
   * Budget gate for the one regen (pipeline v2 §6: a corrective CSS call only
   * starts while ≥120s of the caller's S4 budget remain). Absent → allowed.
   */
  canRegen?: () => boolean;
  /** The audited css is a CARRY-OVER previous sheet (the S2а style leg failed
   *  and pipeline-compile shipped `prevWireCss`), not this generation's output
   *  — the adherence judgement is suppressed (it would grade a sheet the
   *  stylist never wrote against the NEW brief) and the report is marked so
   *  the admin chip stays honest. The gross-defect verdict still runs. */
  carryOver?: boolean;
  /** The css is the code-written fallback sheet, not a stylist's work. Same
   *  suppression of adherence as `carryOver`, plus the regen is spent
   *  UNCONDITIONALLY: a floor that passes the eye test is still a floor, and
   *  this is the one chance to get a real design onto the site. */
  fellBack?: boolean;
  /** Caller's deadline — covers both verdicts AND the regen call. */
  signal?: AbortSignal;
}): Promise<{ css: string | undefined; report: StyleAuditReport }> {
  const report: StyleAuditReport = {
    lintViolations: [],
    contrastFixes: [],
    verdict: "pass",
    regenerated: false,
    flagged: false,
    checkedAt: new Date().toISOString(),
  };
  if (!opts.css) {
    // NOT a pass. A site with no stylesheet renders as the bare grey wireframe,
    // and reporting that as healthy is how one silently shipped: an absent
    // sheet has no violations, so the gate that exists to catch bad design
    // called the total absence of design «pass» (owner report, tepla-pich
    // 2026-08-12). The pipeline now ships a fallback so this should be
    // unreachable — and if it is ever reached again, it says so.
    report.verdict = "fail";
    report.flagged = true;
    report.correctiveNote = "Сайт без згенерованого стилю — показано голий каркас.";
    return { css: opts.css, report };
  }
  if (opts.carryOver) report.carriedOver = true;
  if (opts.fellBack) report.fellBack = true;

  // Phase 1: deterministic, always. Size clamp (spec §9.3): the compile step
  // already enforces the 60k contract on fresh sheets — this belt catches
  // pre-contract rows so the audited css IS what sanitizeCss renders, and the
  // cut is reported, never silent.
  const lint = lintWireCss(opts.css);
  const contrast = fixContrast(lint.cleanCss);
  const clamp = clampCss(contrast.css);
  report.lintViolations = [...lint.violations, ...(clamp.note ? [clamp.note] : [])];
  report.contrastFixes = contrast.fixes;
  let css = clamp.css;

  // Phase 2: one bounded verdict; fail → one regen, re-lint, re-judge.
  try {
    const first = await auditStyleWithModel(css, opts.sectionDigest, opts.designSpec, opts.signal);
    report.verdict = first.verdict;
    report.correctiveNote = first.note;
    // Adherence only for a sheet THIS run's stylist wrote — a carry-over sheet
    // answered a different brief and its "violation" would be a fabrication.
    if (first.adherence && !opts.carryOver && !opts.fellBack) report.adherence = first.adherence;
    // A fallback sheet earns the regen whatever the eye test said: it is a
    // deterministic floor with one accent, and «not ugly» is not the bar.
    const wantsRegen = first.verdict === "fail" || Boolean(opts.fellBack);
    if (wantsRegen && opts.canRegen && !opts.canRegen()) {
      // Budget spent (§6): the regen wouldn't fit — keep the failing verdict
      // honest, `flagged` below surfaces it in the admin QA column.
      console.warn(`[style-audit] corrective regen skipped: S4 budget too low`);
    } else if (wantsRegen) {
      report.regenerated = true;
      const correctedBrief = opts.fellBack
        ? `${opts.brief}\nПопередня спроба стилю не повернула нічого — зараз на сайті лише технічний запасний аркуш. Напиши повноцінний стиль.`
        : `${opts.brief}\nПопередня версія стилю мала ваду — обов'язково уникни її: ${first.note ?? "нечитабельний, конфліктний стиль"}.`;
      const regen = await generateWireStyle(correctedBrief, {
        hue: opts.altHue ?? opts.hue,
        designSpec: opts.designSpec,
        signal: opts.signal,
      });
      const relint = lintWireCss(regen.css);
      const recontrast = fixContrast(relint.cleanCss);
      const reclamp = clampCss(recontrast.css);
      const second = await auditStyleWithModel(
        reclamp.css,
        opts.sectionDigest,
        opts.designSpec,
        opts.signal,
      );
      const regenDetIssues = relint.violations.length;
      // Like-for-like (review must-fix): raw lint counts on BOTH sides. The
      // size-clamp note rides report.lintViolations for REPORTING only —
      // counting it here inflated the original by one and accepted a regen
      // that was not actually cleaner.
      const origDetIssues = lint.violations.length;
      // A real sheet replaces the fallback unless it is itself judged bad: the
      // floor's own «pass» must not keep a stylist's work out.
      if (second.verdict === "pass" || regenDetIssues < origDetIssues || opts.fellBack) {
        css = reclamp.css;
        report.lintViolations = [...relint.violations, ...(reclamp.note ? [reclamp.note] : [])];
        report.contrastFixes = recontrast.fixes;
        report.verdict = second.verdict;
        report.correctiveNote = second.note;
        // The accepted regen WAS generated against this run's designSpec —
        // its adherence is legitimate and the sheet is no longer a carry-over.
        if (second.adherence) report.adherence = second.adherence;
        if (opts.carryOver) report.carriedOver = false;
        if (opts.fellBack) report.fellBack = false;
      }
    }
  } catch (e) {
    console.warn(`[style-audit] model phase failed (fail-open): ${e instanceof Error ? e.message : e}`);
  }
  // Unconditional (plan-review must-fix): a crash mid-regen aborts the block
  // above — a failing verdict must still surface in the admin QA column. A
  // code-proven contrast failure (fixContrast couldn't converge a pair to
  // 4.5:1) flags too, independent of what the model verdict said. Adherence is
  // deliberately NOT a flag input (§3-S4: advisory) — the admin column shows
  // it as its own chip.
  report.flagged =
    report.verdict === "fail" ||
    // Still on the floor after the regen — the site is styled, but nobody
    // designed it, and the admin column must not pretend otherwise.
    Boolean(report.fellBack) ||
    report.contrastFixes.some((f) => f.startsWith("unresolved:"));

  return { css, report };
}
