import { describe, expect, it } from "vitest";
import { INSTRUCTION_MAX, toolInputSchemas, TOOL_LABELS } from "./editor-agent";

/**
 * The owner asked the editor chat to «перегенеруй стилі… зроби які вважаєш за
 * потрібне, it should be stunning» and got this back, verbatim:
 *
 *   Некоректні аргументи: [ { "code": "too_big", "maximum": 400, … } ]
 *
 * Two failures in one line. The cap was 400 characters while the agent's own
 * instructions told it to describe the whole design in ONE call — and when the
 * schema refused, a raw zod dump in English was shown to a Ukrainian small
 * business owner as the product's answer.
 */
describe("update_style — a design direction has to fit", () => {
  const schema = toolInputSchemas.update_style;

  it("accepts a full design brief, not a tweet", () => {
    const brief = (
      "Теплий природний настрій: пісочні й кремові поверхні, акцент кольору випеченої скоринки, " +
      "великі округлі кнопки з мʼякою тінню, більше повітря між секціями, заголовки крупніші й " +
      "щільніші, картки з тонкою рамкою й радіусом 20px. "
    ).repeat(3);
    expect(brief.length).toBeGreaterThan(400);
    expect(schema.safeParse({ instruction: brief }).success).toBe(true);
  });

  it("still has a ceiling, and the tool trims to the same one", () => {
    expect(INSTRUCTION_MAX).toBeGreaterThanOrEqual(2_000);
    expect(schema.safeParse({ instruction: "x".repeat(INSTRUCTION_MAX) }).success).toBe(true);
    expect(schema.safeParse({ instruction: "x".repeat(INSTRUCTION_MAX + 1) }).success).toBe(false);
  });

  it("refuses an empty instruction — there is nothing to do with it", () => {
    expect(schema.safeParse({ instruction: "" }).success).toBe(false);
  });

  it("carries a Ukrainian label, like every other tool the owner watches", () => {
    expect(TOOL_LABELS.update_style).toBe("Перемальовую стиль сайту…");
    for (const [name, label] of Object.entries(TOOL_LABELS)) {
      expect(label, name).toMatch(/[а-яїієґ]/i);
    }
  });
});
