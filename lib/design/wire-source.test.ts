import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractSectionSource } from "./wire-source";

/**
 * The stylist-prompt section extractor (spec §6 note, V5) — exercised against
 * the REAL sections.tsx, because its whole contract is «never drift from that
 * file». What must hold: a typical plan extracts a meaningfully smaller
 * source that still carries every planned section (and the always-injected
 * ones) while dropping unplanned ones; every uncertainty falls back to the
 * full file with `extracted: false`.
 */

const realTsx = readFileSync(
  new URL("../../components/templates/salonwire/sections.tsx", import.meta.url),
  "utf8",
);

// A typical S1 plan's block types incl. the always-injected hero/lead_form/contacts.
const PLANNED = ["hero", "services", "gallery", "testimonials", "cta", "lead_form", "contacts"];

describe("extractSectionSource on the real sections.tsx", () => {
  it("keeps every planned section and saves meaningful size", () => {
    const out = extractSectionSource(realTsx, PLANNED);
    expect(out.extracted).toBe(true);
    expect(out.source.length).toBeLessThan(realTsx.length * 0.95);
    for (const type of PLANNED) {
      expect(out.source).toContain(`BlockProps["${type}"]`);
    }
    // Variants of a planned section ride along (they are the same group).
    expect(out.source).toContain("WireHeroBanner");
    expect(out.source).toContain("WireServicesList");
  });

  it("drops unplanned sections", () => {
    const out = extractSectionSource(realTsx, PLANNED);
    for (const absent of ["WireMap", "WireMarquee", "WirePublications", "WireInstagramCta"]) {
      expect(out.source).not.toContain(`export function ${absent}(`);
    }
  });

  it("keeps the file prelude (imports + the wireframe contract comment)", () => {
    const out = extractSectionSource(realTsx, PLANNED);
    expect(out.source).toContain('import type { BlockProps } from "@/lib/blocks/schema"');
    expect(out.source).toContain("salonwire sections — the WIREFRAME");
  });

  it("is deterministic", () => {
    const a = extractSectionSource(realTsx, PLANNED);
    const b = extractSectionSource(realTsx, [...PLANNED].reverse());
    expect(a).toEqual(b);
  });

  it("falls back to the full file when no planned type matches", () => {
    const out = extractSectionSource(realTsx, ["ghost_block"]);
    expect(out.extracted).toBe(false);
    expect(out.source).toBe(realTsx);
  });

  it("falls back to the full file for an empty plan", () => {
    const out = extractSectionSource(realTsx, []);
    expect(out.extracted).toBe(false);
    expect(out.source).toBe(realTsx);
  });

  it("falls back when the file loses its banner structure", () => {
    const flattened = realTsx.replaceAll("/* ── ", "/* -- ");
    const out = extractSectionSource(flattened, PLANNED);
    expect(out.extracted).toBe(false);
    expect(out.source).toBe(flattened);
  });

  it("falls back when extraction would barely save anything (all sections planned)", () => {
    const everything = [
      "hero", "services", "switchback", "timeline", "gallery", "team", "testimonials",
      "faq", "lead_form", "stats", "cta", "marquee", "publications", "map",
      "instagram_cta", "contacts", "richText",
    ];
    const out = extractSectionSource(realTsx, everything);
    // Every group is kept → below the savings threshold → honest full file.
    expect(out.extracted).toBe(false);
    expect(out.source).toBe(realTsx);
  });
});
