import { describe, expect, it } from "vitest";
import { runStyleAudit, shouldAcceptRegen } from "./style-audit";

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

/**
 * The regen is a REPLACEMENT, so it can make things worse. It nearly did: the
 * first version of the fallback path accepted it unconditionally, which meant a
 * model call that succeeded and returned almost nothing would overwrite the
 * working floor and put the site back to the grey wireframe.
 */
describe("shouldAcceptRegen — a replacement must be an improvement", () => {
  const big = 5_000;

  it("refuses anything too small to be a stylesheet, however it was judged", () => {
    expect(
      shouldAcceptRegen({ verdict: "pass", regenChars: 0, regenIssues: 0, origIssues: 9, fellBack: true }),
    ).toBe(false);
    expect(
      shouldAcceptRegen({ verdict: "pass", regenChars: 120, regenIssues: 0, origIssues: 9, fellBack: false }),
    ).toBe(false);
  });

  it("accepts a real sheet that passes, in both worlds", () => {
    expect(
      shouldAcceptRegen({ verdict: "pass", regenChars: big, regenIssues: 3, origIssues: 0, fellBack: true }),
    ).toBe(true);
    expect(
      shouldAcceptRegen({ verdict: "pass", regenChars: big, regenIssues: 3, origIssues: 0, fellBack: false }),
    ).toBe(true);
  });

  it("keeps the FLOOR over a rejected sheet — plain and working beats rejected", () => {
    expect(
      shouldAcceptRegen({ verdict: "fail", regenChars: big, regenIssues: 0, origIssues: 0, fellBack: true }),
    ).toBe(false);
  });

  it("still takes a cleaner sheet over a stylist's failing one", () => {
    expect(
      shouldAcceptRegen({ verdict: "fail", regenChars: big, regenIssues: 1, origIssues: 4, fellBack: false }),
    ).toBe(true);
    expect(
      shouldAcceptRegen({ verdict: "fail", regenChars: big, regenIssues: 4, origIssues: 4, fellBack: false }),
    ).toBe(false);
  });
});
