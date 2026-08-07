import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_FONT_PAIR_ID, FONT_FAMILIES, FONT_PAIRS, getFontPair } from "./font-pairs";

/**
 * `lib/fonts.ts` cannot be imported here — next/font loaders are Next-compiler
 * magic and throw under plain node — so the loaded-family invariant is checked
 * against the SOURCE: every family the whitelist references must have a loader
 * literal (`variable: "--font-…"`) in lib/fonts.ts or app/layout.tsx
 * (Manrope/Unbounded live on the root <html>).
 */
const fontsSource = readFileSync(join(process.cwd(), "lib/fonts.ts"), "utf8");
const layoutSource = readFileSync(join(process.cwd(), "app/layout.tsx"), "utf8");

const loaderVars = (source: string): Set<string> =>
  new Set([...source.matchAll(/variable:\s*"(--font-[a-z0-9-]+)"/g)].map((m) => m[1]));

describe("font-pair whitelist integrity", () => {
  it("has ~10 pairs with unique ids shaped <heading>-<body>", () => {
    expect(FONT_PAIRS.length).toBeGreaterThanOrEqual(8);
    const ids = FONT_PAIRS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every pair references registered families and carries a vibe + default weight", () => {
    for (const pair of FONT_PAIRS) {
      expect(FONT_FAMILIES[pair.heading], pair.id).toBeDefined();
      expect(FONT_FAMILIES[pair.body], pair.id).toBeDefined();
      expect(pair.vibe.length, pair.id).toBeGreaterThan(0);
      expect(pair.weights.default, pair.id).toBeGreaterThanOrEqual(0);
    }
  });

  it("every one of the 14 loaded families is used by at least one pair", () => {
    const used = new Set(FONT_PAIRS.flatMap((p) => [p.heading, p.body]));
    for (const familyId of Object.keys(FONT_FAMILIES)) {
      expect(used.has(familyId as keyof typeof FONT_FAMILIES), familyId).toBe(true);
    }
  });

  it("the default pair exists in the whitelist", () => {
    expect(getFontPair(DEFAULT_FONT_PAIR_ID)).toBeDefined();
    expect(getFontPair("no-such-pair")).toBeUndefined();
  });
});

describe("whitelist ↔ loaded fonts (source check)", () => {
  const loaded = new Set([...loaderVars(fontsSource), ...loaderVars(layoutSource)]);

  it("every referenced family's CSS variable has a next/font loader", () => {
    for (const [id, family] of Object.entries(FONT_FAMILIES)) {
      expect(loaded.has(family.cssVar), `${id} → ${family.cssVar}`).toBe(true);
    }
  });

  it("TENANT_FONT_VARIABLES export mirrors the loader literals in lib/fonts.ts", () => {
    const block = fontsSource.match(/TENANT_FONT_VARIABLES = \[([^\]]+)\]/)?.[1] ?? "";
    const exported = new Set([...block.matchAll(/"(--font-[a-z0-9-]+)"/g)].map((m) => m[1]));
    expect(exported).toEqual(loaderVars(fontsSource));
  });

  it("PLATFORM_FONT_VARIABLES export mirrors the root-layout loaders", () => {
    const block = fontsSource.match(/PLATFORM_FONT_VARIABLES = \[([^\]]+)\]/)?.[1] ?? "";
    const exported = new Set([...block.matchAll(/"(--font-[a-z0-9-]+)"/g)].map((m) => m[1]));
    expect(exported).toEqual(loaderVars(layoutSource));
  });
});
