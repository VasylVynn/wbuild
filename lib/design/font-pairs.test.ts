import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_FONT_PAIR_ID, FONT_FAMILIES, FONT_PAIRS, getFontPair } from "./font-pairs";

/**
 * Fonts are SELF-HOSTED (scripts/vendor-fonts.mjs → app/fonts.css) since the
 * Google fetch broke two deploys and local dev in one week. The invariant this
 * suite holds is unchanged — every family the whitelist references must
 * actually be loadable — but the artifact it checks moved: app/fonts.css must
 * declare the @font-face AND map the family's --font-* variable in :root.
 */
const fontsSource = readFileSync(join(process.cwd(), "lib/fonts.ts"), "utf8");
const fontsCss = readFileSync(join(process.cwd(), "app/fonts.css"), "utf8");

/** --font-x → family name, from the generated :root block. */
const rootVars = new Map(
  [...fontsCss.matchAll(/^\s{2}(--font-[a-z0-9-]+):\s*"([^"]+)";$/gm)].map((m) => [m[1], m[2]]),
);
const declaredFamilies = new Set(
  [...fontsCss.matchAll(/font-family:\s*'([^']+)';/g)].map((m) => m[1]),
);

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

describe("whitelist ↔ vendored fonts (app/fonts.css)", () => {
  it("every referenced family has a :root variable AND real @font-face blocks", () => {
    for (const [id, family] of Object.entries(FONT_FAMILIES)) {
      const name = rootVars.get(family.cssVar);
      expect(name, `${id} → ${family.cssVar} missing from :root`).toBeDefined();
      expect(declaredFamilies.has(name!), `${id} → no @font-face for "${name}"`).toBe(true);
    }
  });

  it("every WHITELIST family is cyrillic-capable (ґ/є/і/ї live in this range)", () => {
    // One block per family must carry the cyrillic unicode-range — a family
    // without it silently renders Ukrainian in the fallback font. Scoped to
    // the whitelist: fonts.css also vendors legacy-template extras (Poppins et
    // al, "-vendored" suffix) that genuinely lack Cyrillic — those templates
    // are porting source material and never generated into (CLAUDE.md §7).
    const whitelisted = new Map(
      Object.values(FONT_FAMILIES).map((f) => [f.cssVar, rootVars.get(f.cssVar)!]),
    );
    for (const [, name] of whitelisted) {
      const block = new RegExp(
        `font-family: '${name}';[^}]*unicode-range:[^}]*U\\+0400-045F`,
      );
      expect(block.test(fontsCss), `${name} has no cyrillic subset`).toBe(true);
    }
  });

  it("the exported variable lists mirror the :root block", () => {
    const listed = (block: string) =>
      new Set([...(fontsSource.match(new RegExp(`${block} = \\[([^\\]]+)\\]`, "s"))?.[1] ?? "").matchAll(/"(--font-[a-z0-9-]+)"/g)].map((m) => m[1]));
    for (const v of listed("TENANT_FONT_VARIABLES")) {
      expect(rootVars.has(v), `${v} exported but not in fonts.css`).toBe(true);
    }
    for (const v of listed("PLATFORM_FONT_VARIABLES")) {
      expect(rootVars.has(v), `${v} exported but not in fonts.css`).toBe(true);
    }
  });
});
