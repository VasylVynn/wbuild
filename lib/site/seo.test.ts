import { describe, expect, it } from "vitest";
import { localBusinessJsonLd } from "./seo";
import type { Tenant } from "@/lib/tenant/types";

const tenant = (facts: Record<string, unknown>, footer: Tenant["footer"] = {}): Tenant => ({
  id: "t1",
  host: "romashka.example.test",
  canonicalHostname: "romashka.example.test",
  status: "published",
  brand: { businessName: "Ромашка" },
  footer,
  facts,
});

/**
 * JSON-LD null-safety for the V2 facts relax: absent phone/city must be
 * OMITTED from the LocalBusiness block (§10.3 «emits ONLY fields present» —
 * invariant 5: never invented, never an empty string).
 */
describe("localBusinessJsonLd with absent city/phone", () => {
  it("omits telephone and address entirely", () => {
    const json = JSON.parse(localBusinessJsonLd(tenant({ businessName: "Ромашка" })));
    expect(json.telephone).toBeUndefined();
    expect(json.address).toBeUndefined();
    expect(json.name).toBe("Ромашка");
  });

  it("keeps them when the facts carry them", () => {
    const json = JSON.parse(
      localBusinessJsonLd(
        tenant({ businessName: "Ромашка", phone: "+380671234567", city: "Одеса", address: "вул. Квіткова, 1" }),
      ),
    );
    expect(json.telephone).toBe("+380671234567");
    expect(json.address).toEqual({
      "@type": "PostalAddress",
      addressCountry: "UA",
      streetAddress: "вул. Квіткова, 1",
      addressLocality: "Одеса",
    });
  });

  it("falls back to the footer phone when the fact is absent", () => {
    const json = JSON.parse(
      localBusinessJsonLd(tenant({ businessName: "Ромашка" }, { phone: "+380509876543" })),
    );
    expect(json.telephone).toBe("+380509876543");
  });
});
