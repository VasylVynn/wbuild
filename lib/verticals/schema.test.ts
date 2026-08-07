import { describe, expect, it } from "vitest";
import { businessFactsSchema } from "./schema";

/**
 * V2 facts relax (spec §11-V2): city and phone are OPTIONAL. The pre-V2
 * schema required both as z.string(), which forced the W0 ""-bridge in
 * generateDraftAction — these tests pin the new contract: absence parses,
 * stays absent (never becomes ""), and presence round-trips untouched.
 */
describe("businessFactsSchema — optional city/phone", () => {
  it("parses with only a business name", () => {
    const parsed = businessFactsSchema.safeParse({ businessName: "Ромашка" });
    expect(parsed.success).toBe(true);
  });

  it("keeps absent city/phone ABSENT — no \"\" bridge (invariant 5: omitted, never invented)", () => {
    const parsed = businessFactsSchema.parse({ businessName: "Ромашка", instagram: "@romashka" });
    expect("city" in parsed).toBe(false);
    expect("phone" in parsed).toBe(false);
    expect(parsed.city).toBeUndefined();
    expect(parsed.phone).toBeUndefined();
  });

  it("round-trips provided city/phone verbatim", () => {
    const parsed = businessFactsSchema.parse({
      businessName: "Ромашка",
      city: "Одеса",
      phone: "+380 67 123 45 67",
    });
    expect(parsed.city).toBe("Одеса");
    expect(parsed.phone).toBe("+380 67 123 45 67");
  });

  it("still requires businessName", () => {
    expect(businessFactsSchema.safeParse({ city: "Одеса", phone: "0671234567" }).success).toBe(false);
  });
});
