/**
 * WCAG contrast math (design-DNA wave 3). Pure — used by the preset
 * validation script and any future palette tooling. AA thresholds: 4.5:1
 * normal text, 3:1 large text; our preset authoring rule is stricter
 * (7:1 for page text, 4.5:1 for everything else).
 */

function channel(v: number): number {
  const s = v / 255;
  // 0.04045 — the spec-exact sRGB linearization breakpoint (WCAG 2.x errata);
  // identical results for 8-bit integer channels, correct for float inputs.
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** Relative luminance of a #rgb/#rrggbb hex color. */
export function relativeLuminance(hex: string): number {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio between two hex colors (1..21). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export function meetsAA(fg: string, bg: string, large = false): boolean {
  return contrastRatio(fg, bg) >= (large ? 3 : 4.5);
}
