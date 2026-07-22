"use client";

import { useRef, useState } from "react";

/**
 * Photo field for the editor bottom-sheet (§4.8). The client re-encodes the
 * chosen image on a canvas BEFORE upload: this strips EXIF/GPS, fixes the
 * orientation and caps the size — so nothing sensitive leaves the phone and the
 * asset is web-ready. The processed blob is posted to /api/upload, which stores
 * it and returns a public URL we hand back via `onChange`. Styled to the
 * «Небо і мед» photo tiles (design G / Components): dashed add tile, filled
 * tile with a remove badge, and an overlay while working.
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
  conversationId,
  kind,
  onChange,
  onClear,
}: {
  value?: string;
  // Exactly one scoping key: `host` (editor) OR `conversationId` (onboarding,
  // before a host exists). Whichever is set is sent as the /api/upload field.
  host?: string;
  conversationId?: string;
  // "logo" → the server skips the photo quality pass (no brightness/sharpness
  // warnings, no auto-correction) — heuristics for photos, not graphics.
  kind?: "logo" | "photo";
  onChange: (url: string) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  // Soft quality nudges from the server's classical analysis (plan 6а) — never
  // block the upload, just a note; cleared on the next upload/clear.
  const [warnings, setWarnings] = useState<string[]>([]);

  const busy = status === "processing" || status === "uploading";

  async function handleFile(file: File) {
    setError(null);
    setWarnings([]);
    try {
      setStatus("processing");
      const blob = await processImage(file);
      setStatus("uploading");
      const ext = blob.type === "image/webp" ? "webp" : "jpg";
      const fd = new FormData();
      fd.append("file", blob, `photo.${ext}`);
      if (conversationId) fd.append("conversationId", conversationId);
      else if (host) fd.append("host", host);
      if (kind) fd.append("kind", kind);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; url?: string; warnings?: string[] }
        | null;
      if (!res.ok || !json?.url) throw new Error("Сервер не прийняв фото");
      onChange(json.url);
      setWarnings(json.warnings ?? []);
      setStatus("idle");
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Не вдалося завантажити фото");
    }
  }

  function clear() {
    setWarnings([]);
    onClear();
  }

  const pick = () => inputRef.current?.click();
  const tile = "h-28 w-28 shrink-0 overflow-hidden rounded-[16px]";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start gap-3">
        {busy ? (
          <div className={`relative border border-line bg-sunken ${tile}`}>
            {value && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={value} alt="" className="h-full w-full object-cover" />
            )}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-ink/45 text-white">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              <span className="text-[12px] font-bold">
                {status === "processing" ? "Обробка…" : "Завантаження…"}
              </span>
            </div>
          </div>
        ) : value ? (
          <div className={`group relative border border-line bg-sunken ${tile}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="" className="h-full w-full object-cover" />
            {/* Replace: a full-tile overlay (hidden until hover/focus, always
                tappable on touch), sitting UNDER the remove badge so both work. */}
            <button
              type="button"
              onClick={pick}
              aria-label="Замінити фото"
              title="Замінити фото"
              className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-white opacity-0 transition-all hover:bg-ink/55 hover:opacity-100 focus-visible:bg-ink/55 focus-visible:opacity-100 focus:outline-none"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              <span className="text-[12px] font-bold">Замінити</span>
            </button>
            <button
              type="button"
              onClick={clear}
              aria-label="Прибрати фото"
              title="Прибрати фото"
              className="absolute right-1.5 top-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-ink/60 text-[15px] text-white transition-colors hover:bg-ink"
            >
              ×
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={pick}
            className={`flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-line-strong bg-canvas text-center transition-colors hover:border-brand hover:bg-brand-soft ${tile}`}
          >
            <span aria-hidden className="text-[26px] leading-none text-brand">+</span>
            <span className="px-2 text-[12px] font-bold text-ink-muted">Завантажити фото</span>
          </button>
        )}
      </div>

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

      {status === "error" && (
        <p className="text-[14px] font-semibold text-danger">
          {error ?? "Не вдалося завантажити фото."}
        </p>
      )}

      {warnings.length > 0 && (
        <div className="flex flex-col gap-0.5 rounded-[12px] bg-warn-soft px-3.5 py-2.5">
          {warnings.map((w) => (
            <p key={w} className="text-[13px] font-semibold text-warn">
              {w}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
