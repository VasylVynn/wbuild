import type { DesignSpec } from "@/lib/site/design-spec";

/**
 * Seeded nav/footer silhouette variants (pipeline v2 §5) — INTERIM mechanism.
 *
 * Nav and footer are wrapper chrome, not section blocks, so the model never
 * picks their layout — spec §5 makes them seeded axes. The designSpec schema
 * is frozen this wave (V3), so instead of new explicit fields the chrome is
 * DERIVED deterministically from fields the spec already carries
 * (palette.accent + typography.pairId): the same spec always renders the same
 * chrome, so a site's silhouette is stable across requests and only moves when
 * a regeneration changes its palette/typography — exactly when the rest of the
 * design moves too. V5 is expected to promote these to explicit seeded
 * designSpec fields; this module is the single place to rewire when it does.
 *
 * No designSpec (pre-v2 tenants) → the base chrome, no modifier classes.
 * Pure and node-testable on purpose.
 */

export type WireNavVariant = "split" | "centered-brand";
export type WireFooterVariant = "4col" | "2col" | "single";

export interface WireChromeVariants {
  nav: WireNavVariant;
  footer: WireFooterVariant;
}

const NAV: readonly WireNavVariant[] = ["split", "centered-brand"];
const FOOTER: readonly WireFooterVariant[] = ["4col", "2col", "single"];

/** FNV-1a 32-bit — tiny, stable, dependency-free. */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function wireChromeVariants(spec: DesignSpec | undefined): WireChromeVariants {
  if (!spec) return { nav: "split", footer: "4col" };
  // Salted per axis so nav and footer roll independently of each other.
  const key = `${spec.palette.accent}|${spec.typography.pairId}`;
  return {
    nav: NAV[fnv1a(`nav|${key}`) % NAV.length],
    footer: FOOTER[fnv1a(`footer|${key}`) % FOOTER.length],
  };
}
