/**
 * The ONE stylesheet size contract (pipeline v2 spec §9.3). Three ceilings used
 * to coexist: the render-side `sanitizeCss` sliced at 60k, the style audit fed
 * the model up to 80k, and `generateWireStyle`'s 16k output tokens allow ~64k
 * chars — so the audit could approve bytes the renderer silently cut off.
 * 60_000 is now the single number:
 *
 * - S3 compile (`compileWireCss`) clamps the fresh sheet WITH a note that
 *   rides into `styleAudit.compileNotes` — truncation is reported, not silent;
 * - the audit's corrective regen clamps its own output the same way;
 * - the audit prompt slices at the same limit, so the model judges exactly
 *   what ships;
 * - the render-side `sanitizeCss` keeps the same number as a belt for legacy
 *   rows written before the contract.
 *
 * Deliberately NOT "server-only": SalonWireWrapper (render path) imports the
 * constant, and plain-node vitest covers the clamp.
 */
export const CSS_SIZE_LIMIT = 60_000;

/**
 * Clamp a stylesheet to the contract, cutting at the last complete `}` inside
 * the limit so a truncated tail never ships an unbalanced rule. Pure and
 * deterministic; `note` is present exactly when the sheet was cut.
 */
export function clampCss(css: string): { css: string; note?: string } {
  if (css.length <= CSS_SIZE_LIMIT) return { css };
  const slice = css.slice(0, CSS_SIZE_LIMIT);
  const cut = slice.lastIndexOf("}");
  const clamped = cut === -1 ? slice : slice.slice(0, cut + 1);
  return {
    css: clamped,
    note: `css size: ${css.length} chars exceeds the ${CSS_SIZE_LIMIT} contract — truncated to ${clamped.length} at a rule boundary`,
  };
}
