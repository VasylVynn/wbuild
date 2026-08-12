import { FONT_FAMILIES, getFontPair } from "@/lib/design/font-pairs";

/**
 * The stylesheet a site gets when the model wrote none.
 *
 * Until now that case shipped NOTHING. `compileWireCss(undefined, undefined)`
 * returns an empty object, so a brand-new site whose style leg failed went live
 * as the bare grey wireframe — every token at its wire.css default, no accent,
 * no fonts, no motion. That is exactly what an owner sees as «дизайн виглядає
 * занадто просто», and the product could not tell them why: the S4 audit found
 * no stylesheet, therefore no violations, and reported «pass».
 *
 * A model failing is not a reason to ship a colourless page. Everything needed
 * for a real, if plain, design is already computed deterministically before any
 * model is called — the seeded hue, the seeded font pair, the motion level — so
 * this writes them out as CSS. No network, no tokens, no failure mode.
 *
 * Deliberately SMALL. It is a floor, not a competitor to the generated sheet:
 * surface tones, one accent, headings, buttons, section rhythm. When the model
 * does answer, its sheet replaces this one entirely.
 *
 * NOT lint-clean, on purpose, in exactly one respect: it declares `--font-*`,
 * which `lintWireCss` strips. That rule exists to stop a MODEL from overriding
 * fonts the code owns and sets inline at render time (`wireDesignAttrs`). This
 * sheet is written by that same code, and on the path where it is used there is
 * no designSpec, so nothing sets those variables at render time — declaring
 * them here is the ONLY way a v1 site gets its seeded typography. It is
 * therefore injected AFTER compileWireCss and never passed through the lint.
 */
export function buildFallbackWireCss(args: {
  /** Seeded hue anchor, 0–359 (lib/design/seed.ts). */
  hue: number;
  /** Seeded font-pair id — present even on the v1 path, where S1 produced no
   *  designSpec and the renderer therefore sets no font variables itself. */
  pairId?: string;
  /** 0–3; only used to keep transitions off at level 0. */
  motionLevel?: number;
  /** S1's five palette anchors, when S1 succeeded and only the STYLIST failed —
   *  the common shape of a provider brownout (live, avtomaister-2 2026-08-12:
   *  S1 chose a deep dark premium palette, S2а timed out, and the floor dressed
   *  the site in seeded pastel defaults instead — «дизайн гімно» in the
   *  owner's words, with the good palette sitting unused in the draft). */
  palette?: { bg: string; surface: string; ink: string; accent: string; accentInk: string };
}): string {
  const h = ((Math.round(args.hue) % 360) + 360) % 360;
  const pair = getFontPair(args.pairId);
  const heading = pair ? FONT_FAMILIES[pair.heading] : undefined;
  const body = pair ? FONT_FAMILIES[pair.body] : undefined;
  const motion = args.motionLevel ?? 1;
  const p = args.palette;

  // With S1's anchors: use them verbatim — they were chosen for THIS business
  // and already contrast-checked upstream. Without: oklch around the seeded
  // hue keeps the accent's lightness and chroma constant across the wheel, so
  // no hue lands muddy or neon the way raw hsl does.
  const accent = p?.accent ?? `oklch(0.55 0.14 ${h})`;
  const accentHover = p ? p.accent : `oklch(0.47 0.14 ${h})`;
  const accentSoft = p?.surface ?? `oklch(0.95 0.03 ${h})`;
  const surface = p?.surface ?? `oklch(0.99 0.006 ${h})`;
  const canvas = p?.bg ?? `oklch(0.97 0.012 ${h})`;
  const line = p ? `color-mix(in oklab, ${p.ink} 18%, ${p.bg})` : `oklch(0.89 0.02 ${h})`;
  const ink = p?.ink ?? `oklch(0.28 0.03 ${h})`;
  const inkSoft = p ? `color-mix(in oklab, ${p.ink} 72%, ${p.bg})` : `oklch(0.48 0.02 ${h})`;

  const fonts =
    heading && body
      ? `  --font-heading: var(${heading.cssVar}), ${heading.generic};
  --font-body: var(${body.cssVar}), ${body.generic};
`
      : "";

  return `.tpl-salonwire {
${fonts}  --wire-ink: ${ink};
  --wire-ink-soft: ${inkSoft};
  --wire-line: ${line};
  --wire-surface: ${surface};
  --wire-block: ${accentSoft};
  background: ${canvas};
  color: ${ink};
}
.tpl-salonwire .wire-section { padding-block: 4.5rem; }
.tpl-salonwire .wire-section:nth-of-type(even) { background: ${surface}; }
.tpl-salonwire .wire-heading { color: ${ink}; letter-spacing: -0.01em; }
.tpl-salonwire .wire-eyebrow { color: ${accent}; letter-spacing: 0.14em; }
.tpl-salonwire .wire-text { color: ${inkSoft}; }
.tpl-salonwire .wire-card {
  background: ${surface};
  border: 1px solid ${line};
  border-radius: 18px;
}
.tpl-salonwire .wire-btn {
  border-radius: 999px;
  border: 1px solid ${line};
  color: ${ink};
}
.tpl-salonwire .wire-btn--primary {
  background: ${accent};
  border-color: ${accent};
  color: ${p?.accentInk ?? "#fff"};
}
${motion > 0 ? `.tpl-salonwire .wire-btn { transition: background-color 160ms ease, color 160ms ease; }
.tpl-salonwire .wire-btn--primary:hover { background: ${accentHover}; border-color: ${accentHover}; }
` : ""}.tpl-salonwire .wire-nav { background: ${surface}; border-bottom: 1px solid ${line}; }
.tpl-salonwire .wire-footer { background: ${ink}; color: ${surface}; }
.tpl-salonwire .wire-footer__link { color: ${accentSoft}; }
`;
}
