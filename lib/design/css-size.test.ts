import { describe, expect, it } from "vitest";
import { clampCss, CSS_SIZE_LIMIT } from "./css-size";

/**
 * The single stylesheet size contract (spec §9.3). What must hold: a sheet
 * inside the limit passes through UNTOUCHED with no note; an oversized sheet
 * is cut at a rule boundary (never an unbalanced brace) and the cut is
 * reported — truncation must never be silent.
 */

describe("clampCss", () => {
  it("keeps a sheet inside the contract untouched, without a note", () => {
    const css = ".tpl-salonwire .wire-card { color: #111; }";
    const out = clampCss(css);
    expect(out.css).toBe(css);
    expect(out.note).toBeUndefined();
  });

  it("keeps a sheet exactly AT the limit untouched", () => {
    const css = "x".repeat(CSS_SIZE_LIMIT);
    expect(clampCss(css)).toEqual({ css });
  });

  it("truncates an oversized sheet at the last complete rule and reports it", () => {
    const rule = ".tpl-salonwire .wire-text { color: #222222; padding: 4px; }\n";
    const css = rule.repeat(Math.ceil((CSS_SIZE_LIMIT + 5_000) / rule.length));
    const out = clampCss(css);
    expect(out.css.length).toBeLessThanOrEqual(CSS_SIZE_LIMIT);
    expect(out.css.endsWith("}")).toBe(true);
    // Balanced braces — no half-written rule ships.
    expect((out.css.match(/{/g) ?? []).length).toBe((out.css.match(/}/g) ?? []).length);
    expect(out.note).toContain(String(CSS_SIZE_LIMIT));
    expect(out.note).toContain(String(css.length));
  });

  it("degenerate oversized sheet with no closing brace still clamps to the limit", () => {
    const css = "a".repeat(CSS_SIZE_LIMIT + 100);
    const out = clampCss(css);
    expect(out.css.length).toBe(CSS_SIZE_LIMIT);
    expect(out.note).toBeDefined();
  });
});
