import { describe, expect, it } from "vitest";
import { hasForeignMember } from "./claim-gate";

describe("hasForeignMember", () => {
  it("passes an unclaimed tenant (no members)", () => {
    expect(hasForeignMember([], "u1")).toBe(false);
  });

  it("passes when the only member IS the current user (re-generate)", () => {
    expect(hasForeignMember(["u1"], "u1")).toBe(false);
    expect(hasForeignMember(["u1", "u1"], "u1")).toBe(false);
  });

  it("refuses when any member belongs to another account", () => {
    expect(hasForeignMember(["u2"], "u1")).toBe(true);
    expect(hasForeignMember(["u1", "u2"], "u1")).toBe(true);
  });
});
