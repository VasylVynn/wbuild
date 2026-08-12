import { describe, expect, it } from "vitest";
import { runStyleAudit } from "./style-audit";

/**
 * The audit's job is to be believed. A real site (tepla-pich, 2026-08-12)
 * shipped with an empty stylesheet and this gate recorded `verdict: "pass"` —
 * an absent sheet has no violations to find, so the check that exists to catch
 * bad design reported the total absence of design as healthy.
 *
 * No model runs here: the empty-css branch returns before any call, which is
 * exactly the branch that lied.
 */
describe("runStyleAudit — an absent stylesheet is a failure, not a pass", () => {
  const base = { sectionDigest: "hero,services", brief: "brief", hue: 200 };

  it("fails, flags and explains when there is no css at all", async () => {
    const { css, report } = await runStyleAudit({ ...base, css: undefined });
    expect(css).toBeUndefined();
    expect(report.verdict).toBe("fail");
    expect(report.flagged).toBe(true);
    expect(report.correctiveNote).toContain("голий каркас");
  });

  it("treats an empty string the same as absent", async () => {
    const { report } = await runStyleAudit({ ...base, css: "" });
    expect(report.verdict).toBe("fail");
    expect(report.flagged).toBe(true);
  });

  it("does not reach the model to say so", async () => {
    // No ANTHROPIC_API_KEY is needed for the branch above; if it ever started
    // calling out, this would throw or hang rather than resolve instantly.
    const started = Date.now();
    await runStyleAudit({ ...base, css: undefined });
    expect(Date.now() - started).toBeLessThan(500);
  });
});
