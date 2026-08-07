import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("passes plain same-origin paths through", () => {
    expect(safeNext("/sites")).toBe("/sites");
    expect(safeNext("/new?conv=abc-123&resume=1")).toBe("/new?conv=abc-123&resume=1");
    expect(safeNext("/edit/kviti.lvh.me#hero")).toBe("/edit/kviti.lvh.me#hero");
  });

  it("defaults to /sites for absent or non-path values", () => {
    expect(safeNext(null)).toBe("/sites");
    expect(safeNext(undefined)).toBe("/sites");
    expect(safeNext("")).toBe("/sites");
    expect(safeNext("https://evil.com/")).toBe("/sites");
    expect(safeNext("sites")).toBe("/sites");
  });

  it("rejects protocol-relative and backslash tricks", () => {
    expect(safeNext("//evil.com")).toBe("/sites");
    expect(safeNext("/\\evil.com")).toBe("/sites");
  });

  it("rejects control characters the URL parser would strip (open redirect)", () => {
    // decodeURIComponent mirrors how the query param arrives at the handler.
    expect(safeNext(decodeURIComponent("/%09/evil.com"))).toBe("/sites"); // TAB
    expect(safeNext(decodeURIComponent("/%0A/evil.com"))).toBe("/sites"); // LF
    expect(safeNext(decodeURIComponent("/%0D/evil.com"))).toBe("/sites"); // CR
    expect(safeNext("/\t/evil.com")).toBe("/sites");
    expect(safeNext("/\n\\evil.com")).toBe("/sites");
  });

  it("re-validates by construction — a parsed foreign origin never escapes", () => {
    const out = safeNext("/new?conv=abc");
    expect(new URL(out, "https://x.invalid").origin).toBe("https://x.invalid");
  });
});
