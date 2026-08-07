import { describe, expect, it } from "vitest";
import { buildDraftContent, compileWireCss, planBlockTypes } from "./pipeline-compile";
import { getTemplate } from "@/lib/templates/registry";
import type { DesignSpec } from "./design-spec";
import type { PageContent } from "./page-content";
import type { StoredBlock } from "@/lib/blocks/schema";
import type { DesignBriefResult } from "@/lib/ai/design-brief";

/**
 * The deterministic S3 contract of pipeline v2: lint-before-persist (§3-S3),
 * the per-mode write contract (§8), the sectionPlan reconcile, and contentRev
 * minting (§9).
 */

const block = (type: string, section?: string): StoredBlock =>
  ({ type, props: {}, ...(section && { section }) }) as unknown as StoredBlock;

const spec: DesignSpec = {
  positioning: { promise: "Обіцянка", painPoints: [], tone: "тепло" },
  palette: {
    bg: "#ffffff",
    surface: "#f5f5f5",
    ink: "#111111",
    accent: "#7a1f3d",
    accentInk: "#ffffff",
  },
  typography: { pairId: "some-pair" },
  sectionPlan: [{ section: "hero", variant: "split" }, { section: "services" }],
  motion: { level: 1 },
  imagery: { treatment: "повітряні кадри" },
};

const brief: DesignBriefResult = { spec, rationale: "бо так треба", repairs: ["r1"] };

describe("compileWireCss — lint BEFORE persist (§3-S3)", () => {
  it("an unlinted sheet never reaches the persisted payload", () => {
    const raw = [
      `@import url("https://fonts.example/x.css");`,
      `.tpl-salonwire .wire-hero{background-image:url(https://evil.example/x.png);color:#111111;background-color:#ffffff}`,
      `.tpl-salonwire h2{--font-heading:"Comic Sans";letter-spacing:.02em}`,
    ].join("\n");
    const out = compileWireCss(raw, undefined);
    expect(out.wireCss).toBeDefined();
    expect(out.wireCss).not.toContain("evil.example");
    expect(out.wireCss).not.toContain("@import");
    expect(out.wireCss).not.toContain("--font-heading");
    // The honest parts survive.
    expect(out.wireCss).toContain("letter-spacing");
    expect(out.lintNotes.length).toBeGreaterThanOrEqual(3);
  });

  it("no raw sheet → the previous stored sheet (fail-open), never a lint run", () => {
    expect(compileWireCss(undefined, ".old{}")).toEqual({ wireCss: ".old{}", lintNotes: [] });
    expect(compileWireCss(undefined, undefined)).toEqual({ lintNotes: [] });
  });
});

describe("planBlockTypes", () => {
  it("maps planned sections to block types and appends the injected pair", () => {
    const template = getTemplate("salonwire");
    expect(template).toBeDefined();
    const types = planBlockTypes(
      [{ section: "hero" }, { section: "services" }, { section: "not-a-section" }],
      template,
    );
    expect(types[0]).toBe("hero");
    expect(types).toContain("services");
    expect(types.slice(-2)).toEqual(["lead_form", "contacts"]);
    expect(types).not.toContain("not-a-section");
  });
});

describe("buildDraftContent — the §8 write contract", () => {
  const oldDraft: PageContent = {
    blocks: [block("hero", "hero"), block("services", "services")],
    pocket: [block("faq", "faq")],
    genToken: "old-token",
    templateId: "salonwire",
    wireCss: ".old{}",
    seo: { title: "Старий тайтл" },
    styleAudit: {
      lintViolations: [],
      contrastFixes: [],
      verdict: "pass",
      regenerated: false,
      flagged: false,
      checkedAt: "2026-01-01",
    },
    designSpec: spec,
    designRationale: "старе",
    contentRev: 6,
    // A future field unknown to this code — §8: editor must carry it, onboard
    // starts fresh.
    ...({ futureField: "keep-me" } as Partial<PageContent>),
  };
  const blocks = [block("hero", "hero"), block("cta", "cta")];
  const shippedPlan = [{ section: "hero", variant: "banner" }, { section: "cta" }];

  it("onboard: fresh page — empty pocket, no carried keys, contentRev still bumps", () => {
    const out = buildDraftContent({
      mode: "onboard",
      oldDraft,
      blocks,
      templateId: "salonwire",
      seo: { title: "Новий" },
      wireCss: ".new{}",
      brief,
      shippedPlan,
      genToken: "new-token",
    });
    expect(out.blocks).toBe(blocks);
    expect(out.pocket).toEqual([]);
    expect(out.genToken).toBe("new-token");
    expect(out.wireCss).toBe(".new{}");
    expect(out.seo).toEqual({ title: "Новий" });
    expect(out.designRationale).toBe("бо так треба");
    expect(out.contentRev).toBe(7);
    expect((out as unknown as Record<string, unknown>).futureField).toBeUndefined();
    expect(out.styleAudit).toBeUndefined();
  });

  it("onboard without a brief: no designSpec/designRationale keys at all (v1 path)", () => {
    const out = buildDraftContent({
      mode: "onboard",
      blocks,
      templateId: "salonwire",
      shippedPlan,
      genToken: "t",
      brief: null,
    });
    expect("designSpec" in out).toBe(false);
    expect("designRationale" in out).toBe(false);
    expect(out.contentRev).toBe(1); // no old draft → rev starts at 1
  });

  it("editor: spreads oldDraft (unknown keys survive), pockets the old blocks, clears the stale audit", () => {
    const out = buildDraftContent({
      mode: "editor",
      oldDraft,
      blocks,
      templateId: "salonwire",
      wireCss: ".new{}",
      brief,
      shippedPlan,
      genToken: "new-token",
      generatedHero: "https://x/storage/hero.png",
    });
    expect((out as unknown as Record<string, unknown>).futureField).toBe("keep-me");
    // Old pocket + old blocks, order preserved.
    expect(out.pocket?.map((b) => b.type)).toEqual(["faq", "hero", "services"]);
    expect(out.genToken).toBe("new-token");
    expect(out.styleAudit).toBeUndefined();
    expect(out.generatedHero).toBe("https://x/storage/hero.png");
    expect(out.seo).toEqual({ title: "Старий тайтл" }); // no new seo → old survives
    expect(out.contentRev).toBe(7);
  });

  it("editor pocket caps at 40 (slice from the tail)", () => {
    const bigPocket = Array.from({ length: 39 }, (_, i) => block(`p${i}`));
    const out = buildDraftContent({
      mode: "editor",
      oldDraft: { ...oldDraft, pocket: bigPocket },
      blocks,
      templateId: "salonwire",
      shippedPlan,
      genToken: "t",
    });
    // 39 pocketed + 2 old blocks = 41 → the OLDEST entry falls off.
    expect(out.pocket).toHaveLength(40);
    expect(out.pocket?.[0]?.type).toBe("p1");
    expect(out.pocket?.at(-1)?.type).toBe("services");
  });

  it("editor with a v1 fallback (brief null) CLEARS the stale designSpec", () => {
    const out = buildDraftContent({
      mode: "editor",
      oldDraft,
      blocks,
      templateId: "salonwire",
      shippedPlan,
      genToken: "t",
      brief: null,
    });
    expect(out.designSpec).toBeUndefined();
    expect(out.designRationale).toBeUndefined();
  });

  it("reconcile: the persisted sectionPlan is the SHIPPED plan, not the model's", () => {
    const out = buildDraftContent({
      mode: "onboard",
      blocks,
      templateId: "salonwire",
      brief,
      shippedPlan,
      genToken: "t",
    });
    expect(out.designSpec?.sectionPlan).toEqual(shippedPlan);
    // The rest of the spec is untouched.
    expect(out.designSpec?.palette).toEqual(spec.palette);
    // Belt: an (impossible) empty shipped plan keeps the brief's plan so the
    // schema's min(1) stays honest.
    const belt = buildDraftContent({
      mode: "onboard",
      blocks,
      templateId: "salonwire",
      brief,
      shippedPlan: [],
      genToken: "t",
    });
    expect(belt.designSpec?.sectionPlan).toEqual(spec.sectionPlan);
  });
});
