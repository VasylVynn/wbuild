import { FONT_FAMILIES, getFontPair } from "@/lib/design/font-pairs";
import type { DesignSpec } from "@/lib/site/design-spec";

/**
 * designSpec → root attributes for the salonwire wrapper (pipeline v2 §3-S3).
 *
 * Fonts/motion are deliberately NOT written into the generated stylesheet — a
 * wireCss prefix dies on audit-regen and on the 60K tail-slice — so the wrapper
 * sets them at render time from the designSpec stored on the SAME content copy:
 *
 *   - `--font-heading` / `--font-body` inline on `.tpl-salonwire` (inline style
 *     wins the cascade over model CSS at equal importance; the css-lint
 *     strip-set keeps `!important` model overrides out).
 *   - `data-motion` = motion level 0–3; the motion CSS keyed on it lands in V3.
 *
 * Total on `undefined` (spec §3): no designSpec → no attributes at all, and
 * wire.css's own `var(--font-heading, inherit)` fallbacks rule. A spec whose
 * pairId is not in the whitelist (S1 validation normally repairs it, but the
 * renderer must not trust persisted data) → motion only, no font vars.
 *
 * Pure and node-testable — kept out of the .tsx wrapper on purpose.
 */

export interface WireDesignAttrs {
  /** Inline CSS custom properties for the wireframe root, or undefined. */
  style?: Record<string, string>;
  /** Value for `data-motion`, or undefined (attribute omitted). */
  motion?: number;
}

export function wireDesignAttrs(spec: DesignSpec | undefined): WireDesignAttrs {
  if (!spec) return {};
  const pair = getFontPair(spec.typography.pairId);
  const attrs: WireDesignAttrs = { motion: spec.motion.level };
  if (pair) {
    const heading = FONT_FAMILIES[pair.heading];
    const body = FONT_FAMILIES[pair.body];
    attrs.style = {
      // next/font registers the family under its cssVar; the generic keyword
      // keeps text rendering if the loader ever fails.
      "--font-heading": `var(${heading.cssVar}), ${heading.generic}`,
      "--font-body": `var(${body.cssVar}), ${body.generic}`,
    };
  }
  return attrs;
}
