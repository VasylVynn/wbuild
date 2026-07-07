"use client";

import { useRef, useState } from "react";

/**
 * Photo field for the editor bottom-sheet (§4.8). The client re-encodes the
 * chosen image on a canvas BEFORE upload: this strips EXIF/GPS, fixes the
 * orientation and caps the size — so nothing sensitive leaves the phone and the
 * asset is web-ready. The processed blob is posted to /api/upload, which stores
 * it and returns a public URL we hand back via `onChange`.
 */

const MAX_EDGE = 1600; // longest edge, px
const QUALITY = 0.82;

async function processImage(file: File): Promise<Blob> {
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

type Status = "idle" | "processing" | "uploading" | "error";

export default function PhotoField({
  value,
  host,
  onChange,
  onClear,
}: {
  value?: string;
  host: string;
  onChange: (url: string) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const busy = status === "processing" || status === "uploading";

  async function handleFile(file: File) {
    setError(null);
    try {
      setStatus("processing");
      const blob = await processImage(file);
      setStatus("uploading");
      const ext = blob.type === "image/webp" ? "webp" : "jpg";
      const fd = new FormData();
      fd.append("file", blob, `photo.${ext}`);
      fd.append("host", host);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; url?: string } | null;
      if (!res.ok || !json?.url) throw new Error("Сервер не прийняв фото");
      onChange(json.url);
      setStatus("idle");
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Не вдалося завантажити фото");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {value ? (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="max-h-48 w-full object-cover" />
        </div>
      ) : (
        <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50 text-sm text-neutral-400">
          Фото ще немає
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = ""; // allow re-picking the same file
        }}
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="inline-flex min-h-12 items-center justify-center rounded-full bg-neutral-900 px-5 text-base font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50"
        >
          {status === "processing"
            ? "Обробка…"
            : status === "uploading"
              ? "Завантаження…"
              : value
                ? "Замінити фото"
                : "Завантажити фото"}
        </button>
        {value && !busy && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-neutral-300 px-5 text-base font-medium text-neutral-700 transition hover:bg-neutral-100"
          >
            Прибрати фото
          </button>
        )}
      </div>

      {status === "error" && (
        <p className="text-sm text-red-600">{error ?? "Не вдалося завантажити фото."}</p>
      )}
    </div>
  );
}
