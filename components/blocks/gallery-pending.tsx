/**
 * Shimmer placeholders for galleries whose images are still being GENERATED in
 * the background (publish.ts after()-job): the section renders immediately with
 * animated tiles, the real images are patched in later — even post-publish.
 *
 * Theme-agnostic: the tile tints from `currentColor`, so it reads correctly on
 * dark (studio) and light (beleza/salon) template surfaces alike.
 */

export function PendingTile({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`animate-pulse rounded-2xl ${className}`}
      style={{ backgroundColor: "color-mix(in srgb, currentColor 10%, transparent)" }}
    />
  );
}

/** How many shimmer tiles to render: only when the gallery has NO real images. */
export function pendingTileCount(images: readonly unknown[], pendingImages?: number): number {
  return images.length === 0 ? Math.min(pendingImages ?? 0, 8) : 0;
}
