import type { CSSProperties, ReactNode } from "react";

/**
 * Decorative page treatments (wave DNA-3, `decorId` from the design DNA).
 *
 * A CSS-only, fixed, `pointer-events:none`, `aria-hidden` wash painted BEHIND
 * page content — the axis that makes photo-poor CLASSIC (registry) sites look
 * deliberately designed instead of blank. Every color is a tenant CSS var
 * (`var(--color-*)`) blended toward transparent, so each treatment reads right
 * on any preset, light or dark, and the visual weight stays low enough to never
 * fight text. Everything is static (no animation) — nothing to gate behind
 * `prefers-reduced-motion`.
 *
 * Stacking: the layer sits at `z-index:-1`. Its host wrapper must be a stacking
 * context (`isolation:isolate`) so the layer paints ABOVE the wrapper's opaque
 * background but BELOW the in-flow content (see `app/s/[host]/layout.tsx` and
 * the editor frame). Unknown/absent id → renders nothing.
 */

export const DECOR_IDS = [
  "mesh-soft",
  "dot-grid",
  "diagonal",
  "noise",
  "frame",
  "waves",
] as const;
export type DecorId = (typeof DECOR_IDS)[number];

function isDecorId(value: string | undefined): value is DecorId {
  return value !== undefined && (DECOR_IDS as readonly string[]).includes(value);
}

/** A tenant color var blended toward transparent — the only way to get low
 *  alpha out of an opaque `var(--color-*)` (same `color-mix` trick as tokens). */
function tint(varName: string, pct: number): string {
  return `color-mix(in srgb, var(${varName}) ${pct}%, transparent)`;
}

const base: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: -1,
  pointerEvents: "none",
  overflow: "hidden",
};

/**
 * Grayscale film grain, generated (not fetched): a `feTurbulence` desaturated
 * to gray so it stays theme-neutral and only the CSS opacity below tints it.
 */
const NOISE_URI =
  "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='180'%20height='180'%3E%3Cfilter%20id='n'%3E%3CfeTurbulence%20type='fractalNoise'%20baseFrequency='0.9'%20numOctaves='2'%20stitchTiles='stitch'/%3E%3CfeColorMatrix%20type='saturate'%20values='0'/%3E%3C/filter%3E%3Crect%20width='100%25'%20height='100%25'%20filter='url(%23n)'/%3E%3C/svg%3E";

export function DecorLayer({ decorId }: { decorId?: string }): ReactNode {
  if (!isDecorId(decorId)) return null;

  switch (decorId) {
    case "mesh-soft":
      // Two-to-three oversized soft radials from accent/primary — a gentle
      // color mesh anchored to the viewport corners.
      return (
        <div
          aria-hidden
          className="print:hidden"
          style={{
            ...base,
            background: [
              `radial-gradient(60% 55% at 12% 18%, ${tint("--color-accent", 26)} 0%, transparent 62%)`,
              `radial-gradient(55% 50% at 88% 22%, ${tint("--color-primary", 22)} 0%, transparent 58%)`,
              `radial-gradient(70% 65% at 50% 108%, ${tint("--color-accent", 16)} 0%, transparent 60%)`,
            ].join(", "),
          }}
        />
      );

    case "dot-grid":
      // Faint fixed dot lattice from muted-foreground (guaranteed to contrast
      // on both themes, unlike the light `muted` tint).
      return (
        <div
          aria-hidden
          className="print:hidden"
          style={{
            ...base,
            backgroundImage: `radial-gradient(${tint("--color-muted-foreground", 30)} 1px, transparent 1.6px)`,
            backgroundSize: "24px 24px",
          }}
        />
      );

    case "diagonal":
      // One soft accent band + one crisp primary hairline, both raked across
      // the viewport.
      return (
        <div
          aria-hidden
          className="print:hidden"
          style={{
            ...base,
            background: `linear-gradient(120deg, transparent 30%, ${tint("--color-accent", 10)} 38%, ${tint("--color-accent", 10)} 44%, transparent 52%, transparent 66%, ${tint("--color-primary", 15)} 66.4%, ${tint("--color-primary", 15)} 67.1%, transparent 67.6%)`,
          }}
        />
      );

    case "noise":
      // Very-low-opacity grayscale grain: subtle paper/film texture that reads
      // as intentional on flat presets. Data URI is generated, never fetched.
      return (
        <div
          aria-hidden
          className="print:hidden"
          style={{
            ...base,
            backgroundImage: `url("${NOISE_URI}")`,
            opacity: 0.06,
          }}
        />
      );

    case "frame":
      // Thin double-hairline inset frame — a poster-like border pinned to the
      // viewport edges. muted-foreground keeps it visible on light and dark.
      return (
        <div aria-hidden className="print:hidden" style={base}>
          <div
            style={{
              position: "absolute",
              inset: "14px",
              border: `1px solid ${tint("--color-muted-foreground", 38)}`,
              borderRadius: "2px",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: "19px",
              border: `1px solid ${tint("--color-muted-foreground", 22)}`,
              borderRadius: "1px",
            }}
          />
        </div>
      );

    case "waves":
      // Token-driven aurora: large, heavily blurred, STATIC blobs (the salon
      // aurora without framer-motion) drawn from accent/primary.
      return (
        <div aria-hidden className="print:hidden" style={base}>
          <div
            style={{
              position: "absolute",
              top: "-12%",
              left: "-8%",
              width: "48vw",
              height: "48vw",
              borderRadius: "50%",
              background: tint("--color-accent", 30),
              filter: "blur(90px)",
              opacity: 0.6,
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: "-16%",
              right: "-6%",
              width: "52vw",
              height: "52vw",
              borderRadius: "50%",
              background: tint("--color-primary", 26),
              filter: "blur(100px)",
              opacity: 0.55,
            }}
          />
          <div
            style={{
              position: "absolute",
              top: "36%",
              left: "56%",
              width: "34vw",
              height: "34vw",
              borderRadius: "50%",
              background: tint("--color-accent", 20),
              filter: "blur(80px)",
              opacity: 0.5,
            }}
          />
        </div>
      );
  }
}
