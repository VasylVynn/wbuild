import { describe, it, expect } from "vitest";
import { normalizeDomain } from "./rdap";

/**
 * normalizeDomain guards a manual-ops pipeline: whatever survives it is what a
 * human types into a registrar. Network lookups (checkAvailability) are not
 * covered here on purpose — they'd be a live RDAP dependency in CI.
 */
describe("normalizeDomain", () => {
  it("keeps a plain domain as-is", () => {
    expect(normalizeDomain("kvitka.com.ua")).toBe("kvitka.com.ua");
  });

  it("strips the noise people actually paste", () => {
    expect(normalizeDomain("  HTTPS://WWW.Kvitka.com.ua/pro-nas?a=1  ")).toBe("kvitka.com.ua");
    expect(normalizeDomain("kvitka.ua:443")).toBe("kvitka.ua");
    expect(normalizeDomain("kvitka.ua.")).toBe("kvitka.ua");
  });

  it("rejects anything that isn't a registrable ASCII domain", () => {
    expect(normalizeDomain("")).toBeNull();
    expect(normalizeDomain("kvitka")).toBeNull(); // no dot
    expect(normalizeDomain("квітка.укр")).toBeNull(); // IDN — out of scope
    expect(normalizeDomain("-kvitka.ua")).toBeNull();
    expect(normalizeDomain("kvitka-.ua")).toBeNull();
    expect(normalizeDomain("kvitka..ua")).toBeNull();
    expect(normalizeDomain("kvitka.u")).toBeNull(); // TLD too short
    expect(normalizeDomain("kvitka.123")).toBeNull(); // numeric TLD
    expect(normalizeDomain(`${"a".repeat(64)}.ua`)).toBeNull(); // label > 63
  });

  it("refuses our own hosts — nobody 'buys' a platform domain", () => {
    expect(normalizeDomain("wizz-app.net")).toBeNull();
    expect(normalizeDomain("kvitka.wizz-app.net")).toBeNull();
    expect(normalizeDomain("3minsite.com")).toBeNull();
    expect(normalizeDomain("kvitka.lvh.me")).toBeNull(); // NEXT_PUBLIC_ROOT_DOMAIN default
  });
});
