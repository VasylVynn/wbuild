import { describe, expect, it } from "vitest";
import { validateFacts, validatePhone, validateCity } from "./validate";
import { hasContactChannel } from "./contact-channel";
import { getVertical } from "@/lib/verticals/registry";

/**
 * Consumer null-safety for the V2 facts relax (spec §11-V2): city/phone are
 * optional in businessFactsSchema now, so every pure consumer must treat
 * `undefined` as «not provided» — no issue raised, no invented value.
 */
describe("fact validators with absent city/phone", () => {
  it("validatePhone/validateCity accept undefined silently", () => {
    expect(validatePhone(undefined)).toBeNull();
    expect(validateCity(undefined)).toBeNull();
  });

  it("validateFacts raises no city/phone issues when both are absent", () => {
    const issues = validateFacts({ businessName: "Ромашка" }, getVertical("generic"));
    expect(issues.filter((i) => i.field === "phone" || i.field === "city")).toEqual([]);
  });

  it("still flags a garbage phone when one IS provided", () => {
    expect(validatePhone("+380988888888івйцф2")).not.toBeNull();
  });
});

describe("hasContactChannel without a phone", () => {
  it("any single channel satisfies the requisite", () => {
    expect(hasContactChannel({ instagram: "@romashka" })).toBe(true);
    expect(hasContactChannel({ telegram: "romashka" })).toBe(true);
    expect(hasContactChannel({ phone: "0671234567" })).toBe(true);
  });

  it("no channel at all fails it", () => {
    expect(hasContactChannel({ businessName: "Ромашка", city: "Одеса" })).toBe(false);
    expect(hasContactChannel({ phone: "   " })).toBe(false);
  });
});
