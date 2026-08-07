import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PAIRS, PAIRS_EXEMPT } from "./css-contrast";

/**
 * PAIRS maintenance guard (pipeline v2 §5): fixContrast's text↔surface map is
 * HAND-KEPT against the wireframe's markup, and the wireframe is edited by a
 * parallel session — this test is the coordination contract between them, so
 * the coupling rots loudly instead of silently:
 *
 *  1. every class PAIRS references must still exist in the wireframe markup;
 *  2. every variant-modifier class (`wire-<section>--<variant>`) in the markup
 *     must carry ≥1 PAIRS entry or an explicit, commented PAIRS_EXEMPT entry.
 *
 * The wireframe side of the contract: variant modifiers MUST be named
 * `wire-<section>--<variant>` (sections: hero|services|gallery|testimonials|
 * cta|process|nav|footer) — a modifier named outside that shape is invisible
 * to this guard. Class extraction is a heuristic over className literals
 * (plain strings and template literals), which is exactly how the wireframe
 * writes them — it uses no computed class names by design.
 */

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");
const SOURCES = [
  "components/templates/salonwire/sections.tsx",
  // Nav/footer (and their variants when the wireframe adds them) live in the
  // wrapper, not in sections.tsx.
  "components/templates/salonwire/SalonWireWrapper.tsx",
];

/** All wire-* tokens appearing inside className literals. Template-literal
 *  bodies are scanned raw, so conditional classes inside `${…}` (e.g. the
 *  banner's wire-hero--scrim) are found too. */
function classTokens(src: string): Set<string> {
  const out = new Set<string>();
  for (const m of src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
    for (const t of (m[1] ?? m[2] ?? "").match(/wire-[a-zA-Z0-9_-]+/g) ?? []) out.add(t);
  }
  return out;
}

const markup = new Set(SOURCES.flatMap((s) => [...classTokens(read(s))]));

const VARIANT_MODIFIER_RE =
  /^wire-(?:hero|services|gallery|testimonials|cta|process|nav|footer)--[a-z0-9-]+$/;

describe("PAIRS ↔ wireframe markup coupling", () => {
  it("extracts a sane token set (heuristic self-check)", () => {
    // If the extraction regex ever stops matching the wireframe's className
    // style, both directions below would pass vacuously — pin known classes.
    expect([...markup]).toEqual(expect.arrayContaining(["wire-hero", "wire-title", "wire-footer"]));
  });

  it("every class PAIRS references still exists in the wireframe markup", () => {
    const missing = PAIRS.flatMap((p) => [p.text, p.surface])
      .map((cls) => cls.replace(/^\./, ""))
      .filter((cls) => !markup.has(cls));
    expect(missing, "PAIRS references classes the wireframe no longer renders").toEqual([]);
  });

  it("every variant-modifier class is contrast-paired or explicitly exempt", () => {
    const covered = new Set(PAIRS.flatMap((p) => [p.text.slice(1), p.surface.slice(1)]));
    const uncovered = [...markup]
      .filter((t) => VARIANT_MODIFIER_RE.test(t))
      .filter((t) => !covered.has(t) && !PAIRS_EXEMPT.has(t))
      .sort();
    expect(
      uncovered,
      "new variant modifier classes need a PAIRS entry or a commented PAIRS_EXEMPT entry (lib/design/css-contrast.ts)",
    ).toEqual([]);
  });
});
