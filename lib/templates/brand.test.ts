import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTemplateBrand, resolveDisplayLogo } from "./brand";
import type { SiteTemplate } from "./registry";
import type { DesignSpec } from "@/lib/site/design-spec";

/**
 * The designSpec render-threading contract (pipeline v2 §3): the brief stored
 * on a page-content copy must ride buildTemplateBrand into TemplateBrand — the
 * only channel through which the wireframe wrapper can see it.
 */

// Minimal stand-in — importing the real registry would drag every template
// component module (and its CSS) into a node-only test run.
const template = {
  id: "salonwire",
  label: "",
  description: "",
  verticalIds: [],
  order: [],
  sections: {},
  wrapper: () => null,
} as unknown as SiteTemplate;

/** salonwire's real section labels, minus the components. */
const SECTION_IDS = [
  "hero", "services", "story", "process", "gallery", "team", "testimonials",
  "faq", "lead_form", "contacts", "stats", "cta", "values", "press", "map",
  "instagram_cta",
  // A registered section the rank table has never heard of — the "new section"
  // case must degrade to "sorts last", not to "sorts first".
  "newthing",
];
const navTemplate = {
  ...template,
  sections: Object.fromEntries(SECTION_IDS.map((s) => [s, { block: s, label: s }])),
} as unknown as SiteTemplate;

const page = (...sections: string[]) =>
  sections.map((section) => ({ type: section, section, props: {} })) as unknown as Parameters<
    typeof buildTemplateBrand
  >[1];

const spec: DesignSpec = {
  positioning: { promise: "", painPoints: [], tone: "тепло" },
  palette: {
    bg: "#faf7f2",
    surface: "#ffffff",
    ink: "#2b2118",
    accent: "#7a1f3d",
    accentInk: "#ffffff",
  },
  typography: { pairId: "playfair-inter" },
  sectionPlan: [{ section: "hero" }],
  motion: { level: 3 },
  imagery: { treatment: "повітряно" },
};

describe("buildTemplateBrand designSpec threading", () => {
  it("passes designSpec through to TemplateBrand", () => {
    const brand = buildTemplateBrand("Квіти Люба", [], template, undefined, ".x{}", spec);
    expect(brand.designSpec).toBe(spec);
    expect(brand.wireCss).toBe(".x{}");
  });

  it("omits the key entirely when designSpec is absent (pre-v2 content)", () => {
    const brand = buildTemplateBrand("Квіти Люба", [], template);
    expect("designSpec" in brand).toBe(false);
  });
});

/**
 * NAV BUDGET (owner audit 2026-08-10): a real site rendered NINE nav links and
 * «Залишити заявку» wrapped onto a second row at 1440px. The bar is one row per
 * band at every width, so the count is capped HERE — wire.css can only keep the
 * silhouette from breaking, it cannot invent space. A wrapped CTA is a broken
 * funnel (invariant 8), so the cap is the contract, not a suggestion.
 */
describe("buildTemplateBrand nav budget", () => {
  const navOf = (...sections: string[]) =>
    (buildTemplateBrand("Школа тенісу", page(...sections), navTemplate).navLinks ?? []).map(
      (l) => l.href,
    );

  it("caps the nav at four links — five plus a wordmark hid 102px at 768px", () => {
    // The audited page, verbatim.
    const nav = navOf(
      "hero", "services", "story", "process", "gallery", "team",
      "testimonials", "faq", "values", "press", "map", "instagram_cta",
      "lead_form", "contacts",
    );
    expect(nav.length).toBe(4);
  });

  it("keeps the highest-priority sections and drops the rest, not the tail", () => {
    const nav = navOf("hero", "process", "faq", "testimonials", "story", "team", "gallery", "services");
    // services > gallery > team > story > testimonials > process > faq
    expect(new Set(nav)).toEqual(new Set(["#services", "#gallery", "#team", "#story"]));
  });

  it("indexes EVERY destination in allSectionLinks — dropped is not lost", () => {
    // The footer renders this list, which is what makes «dropped, not menued»
    // honest: a section the nav has no room for is still linked somewhere.
    const brand = buildTemplateBrand(
      "Школа тенісу",
      page("hero", "services", "story", "gallery", "team", "faq", "map", "press", "lead_form", "contacts"),
      navTemplate,
    );
    expect(brand.navLinks?.length).toBe(4);
    expect((brand.allSectionLinks ?? []).map((l) => l.href)).toEqual([
      "#services", "#story", "#gallery", "#team", "#faq", "#map", "#press",
    ]);
  });

  it("budgets the WIREFRAME only — legacy templates keep the list they always got", () => {
    // buildTemplateBrand is shared by eleven published templates whose Nav AND
    // Footer both render navLinks; capping them would silently drop links from
    // live pages that are never regenerated.
    const legacy = { ...navTemplate, id: "studio" } as unknown as SiteTemplate;
    const nav = (
      buildTemplateBrand("X", page("services", "story", "gallery", "team", "faq", "map"), legacy).navLinks ?? []
    ).map((l) => l.href);
    expect(nav).toEqual(["#services", "#story", "#gallery", "#team", "#faq", "#map"]);
  });

  it("renders the kept links in DOCUMENT order, not in rank order", () => {
    expect(navOf("hero", "faq", "team", "services")).toEqual(["#faq", "#team", "#services"]);
  });

  it("never lists a destination the nav has no business pointing at", () => {
    // hero/stats/cta/lead_form/contacts + the audit's additions.
    expect(
      navOf("hero", "stats", "cta", "banner", "lead_form", "contacts", "map", "instagram_cta", "press", "values"),
    ).toEqual([]);
  });

  it("ignores hidden sections and de-dupes repeatable ones", () => {
    const blocks = page("services", "gallery", "services");
    (blocks[1] as { hidden?: boolean }).hidden = true;
    const nav = (buildTemplateBrand("X", blocks, navTemplate).navLinks ?? []).map((l) => l.href);
    expect(nav).toEqual(["#services"]);
  });

  it("an unranked new section sorts after every named one, never displacing them", () => {
    const nav = navOf("services", "gallery", "team", "story", "newthing", "testimonials");
    expect(nav).not.toContain("#newthing");
  });
});

/** ONE door into the display logo: the record, storage-checked. The bare-string
 *  overload is gone — it skipped that check (invariant 1) and by the end existed
 *  only to keep these two lines compiling. */
describe("buildTemplateBrand logo plate", () => {
  const SUPABASE_URL = "https://proj.supabase.co";
  const stored = `${SUPABASE_URL}/storage/v1/object/public/photos/t/logo.webp`;
  const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  beforeAll(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
  });
  afterAll(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = prevUrl;
  });

  it("threads the measured plate through; absent stays absent (no plate is safe)", () => {
    expect(
      buildTemplateBrand("X", [], template, { logoUrl: stored, logoPlate: "#0b0b0b" }).logoPlate,
    ).toBe("#0b0b0b");
    expect("logoPlate" in buildTemplateBrand("X", [], template, { logoUrl: stored })).toBe(false);
  });
});

/**
 * The display-logo contract (V9 / owner audit L1). The URL choice belongs to
 * `brandLogoUrl` (lib/media/media.ts) — these cover what buildTemplateBrand adds
 * on top: passing `tenant.brand` whole works, and the PLATE stays paired with
 * the asset it was measured from. A plate carried onto an adapted, now
 * transparent mark would paint the original's opaque canvas back behind it —
 * the black slab the adaptation just removed.
 */
describe("resolveDisplayLogo — adapted over original, plate paired to the asset", () => {
  const SUPABASE_URL = "https://proj.supabase.co";
  const stored = (name: string) =>
    `${SUPABASE_URL}/storage/v1/object/public/photos/t/${name}.webp`;
  const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  beforeAll(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
  });
  afterAll(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = prevUrl;
  });

  it("shows the adapted mark and DROPS the original's plate with it", () => {
    expect(
      resolveDisplayLogo({
        logoUrl: stored("orig"),
        logoAdaptedUrl: stored("adapted"),
        logoPlate: "#0b0b0b",
      }),
    ).toEqual({ logoUrl: stored("adapted") });
  });

  it("falls back to the original WITH its plate when no adaptation was possible", () => {
    expect(resolveDisplayLogo({ logoUrl: stored("orig"), logoPlate: "#0b0b0b" })).toEqual({
      logoUrl: stored("orig"),
      logoPlate: "#0b0b0b",
    });
  });

  it("keeps a NEUTRAL chip when the adapted mark's own ink is as pale as the nav", () => {
    // The measured tennis badge: masking the black square away leaves a pale
    // blue disc (mean L* ≈ 90) on a #fafafa nav (L* ≈ 98) — invisible without a
    // chip, and the chip is a neutral, never the black slab we just removed.
    expect(
      resolveDisplayLogo({ logoUrl: stored("orig"), logoAdaptedUrl: stored("adapted"), logoInkL: 90 }),
    ).toEqual({ logoUrl: stored("adapted"), logoPlate: "#1c1c1c" });
  });

  it("gives a dark adapted mark no chip — it already reads on the light chrome", () => {
    expect(resolveDisplayLogo({ logoAdaptedUrl: stored("adapted"), logoInkL: 22 })).toEqual({
      logoUrl: stored("adapted"),
    });
  });

  it("refuses a foreign URL in either field (invariant 1)", () => {
    expect(
      resolveDisplayLogo({
        logoUrl: "https://cdn.example.com/logo.png",
        logoAdaptedUrl: "https://cdn.example.com/logo-cut.png",
      }),
    ).toEqual({});
    expect(resolveDisplayLogo(undefined)).toEqual({});
  });

  it("buildTemplateBrand takes the record whole — both chrome placements read one field", () => {
    const brand = buildTemplateBrand("X", [], template, {
      logoUrl: stored("orig"),
      logoAdaptedUrl: stored("adapted"),
      logoPlate: "#0b0b0b",
    });
    expect(brand.logoUrl).toBe(stored("adapted"));
    expect("logoPlate" in brand).toBe(false);
  });
});
