/**
 * Browser-only image pre-processor (§4.8). Re-encodes a chosen image on a canvas
 * BEFORE upload: strips EXIF/GPS, bakes in the orientation and caps the longest
 * edge — nothing sensitive leaves the device and the asset is web-ready.
 *
 * NOTE: this is a DELIBERATE duplicate of the canvas logic in
 * `components/editor/PhotoField.tsx`. That component currently carries
 * uncommitted parallel-session changes and must not be touched, so the onboarding
 * chat-upload flow gets its own copy. Dedupe (have PhotoField import this) once
 * the parallel work lands.
 */

const MAX_EDGE = 1600; // longest edge, px
const QUALITY = 0.82;

export async function processImage(file: File): Promise<Blob> {
  // `imageOrientation: "from-image"` bakes the EXIF rotation into the pixels,
  // so the re-encoded (EXIF-free) image still looks the right way up.
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const longest = Math.max(bitmap.width, bitmap.height);
  const scale = longest > MAX_EDGE ? MAX_EDGE / longest : 1;
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas недоступний");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const toBlob = (type: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), type, QUALITY));

  // webp is smaller; some engines return null for it → fall back to jpeg.
  const webp = await toBlob("image/webp");
  if (webp) return webp;
  const jpeg = await toBlob("image/jpeg");
  if (jpeg) return jpeg;
  throw new Error("Не вдалося обробити фото");
}
