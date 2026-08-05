import { afterEach, describe, expect, it } from "vitest";
import { isDashboardHost, isPlatformHost } from "./config";

/**
 * Host-splitting rules with the brand-migration overlap
 * (NEXT_PUBLIC_EXTRA_PLATFORM_ROOTS). ROOT_DOMAIN here is the test default
 * lvh.me:3000 — extra roots are read at call time, so they can be stubbed.
 */

afterEach(() => {
  delete process.env.NEXT_PUBLIC_EXTRA_PLATFORM_ROOTS;
});

describe("isPlatformHost — primary root", () => {
  it("accepts root, www and app; rejects tenants and foreign hosts", () => {
    expect(isPlatformHost("lvh.me:3000")).toBe(true);
    expect(isPlatformHost("www.lvh.me")).toBe(true);
    expect(isPlatformHost("app.lvh.me")).toBe(true);
    expect(isPlatformHost("florist.lvh.me")).toBe(false);
    expect(isPlatformHost("3minsite.com.ua")).toBe(false);
  });
});

describe("extra platform roots", () => {
  it("a listed extra root serves marketing, www and app", () => {
    process.env.NEXT_PUBLIC_EXTRA_PLATFORM_ROOTS = "3minsite.com.ua";
    expect(isPlatformHost("3minsite.com.ua")).toBe(true);
    expect(isPlatformHost("www.3minsite.com.ua")).toBe(true);
    expect(isPlatformHost("app.3minsite.com.ua")).toBe(true);
    expect(isDashboardHost("app.3minsite.com.ua")).toBe(true);
  });

  it("subdomains of an extra root are still tenants", () => {
    process.env.NEXT_PUBLIC_EXTRA_PLATFORM_ROOTS = "3minsite.com.ua";
    expect(isPlatformHost("florist.3minsite.com.ua")).toBe(false);
  });

  it("handles whitespace, ports and case in the env value", () => {
    process.env.NEXT_PUBLIC_EXTRA_PLATFORM_ROOTS = " 3Minsite.com.ua:443 , second.example ";
    expect(isPlatformHost("www.3minsite.com.ua")).toBe(true);
    expect(isPlatformHost("second.example")).toBe(true);
  });

  it("unset/empty env changes nothing", () => {
    process.env.NEXT_PUBLIC_EXTRA_PLATFORM_ROOTS = "";
    expect(isPlatformHost("www.3minsite.com.ua")).toBe(false);
  });
});
