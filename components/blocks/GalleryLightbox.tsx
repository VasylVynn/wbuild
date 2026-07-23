"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** Minimal shape a lightbox needs — matches a gallery block's `images[]` entry. */
export interface LightboxImage {
  url: string;
  alt?: string;
  title?: string;
  category?: string;
}

/**
 * Shared fullscreen lightbox for gallery tiles: every gallery renderer calls
 * `useLightbox(images)` once, wires each REAL-image tile's click to
 * `open(index)`, and mounts `overlay` once at the section level.
 *
 * `overlay` must be mounted OUTSIDE any per-tile animated wrapper (Reveal /
 * ScrollReveal / framer-motion `motion.div`) — a `transform` on an ancestor
 * creates a new containing block for `position: fixed`, which would trap the
 * fullscreen overlay inside that tile's small box instead of the viewport.
 */
export function useLightbox(images: readonly LightboxImage[]) {
  const [index, setIndex] = useState<number | null>(null);

  const open = useCallback((i: number) => setIndex(i), []);
  const close = useCallback(() => setIndex(null), []);
  const prev = useCallback(() => {
    setIndex((i) => (i === null ? i : (i - 1 + images.length) % images.length));
  }, [images.length]);
  const next = useCallback(() => {
    setIndex((i) => (i === null ? i : (i + 1) % images.length));
  }, [images.length]);

  const current = index !== null ? images[index] : undefined;
  const overlay = current ? (
    <LightboxOverlay
      image={current}
      hasMultiple={images.length > 1}
      onClose={close}
      onPrev={prev}
      onNext={next}
    />
  ) : null;

  return { open, overlay };
}

function LightboxOverlay({
  image,
  hasMultiple,
  onClose,
  onPrev,
  onNext,
}: {
  image: LightboxImage;
  hasMultiple: boolean;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  // Portal to <body> so the fixed overlay lives in the ROOT stacking context —
  // gallery sections use `isolation: isolate` / positioned wrappers, which would
  // otherwise trap our z-[100] below a sticky nav (z-50) painted at the root.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Lock page scroll, focus the dialog, and RESTORE focus to the trigger on
  // close (a11y): capture whatever was focused (the gallery tile) before we
  // steal focus, and hand it back when the overlay unmounts.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const trigger = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      trigger?.focus?.();
    };
  }, []);

  // Esc closes; arrows navigate; Tab is trapped inside the dialog so focus can't
  // escape behind the modal onto the live page.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (hasMultiple && e.key === "ArrowLeft") {
        onPrev();
        return;
      }
      if (hasMultiple && e.key === "ArrowRight") {
        onNext();
        return;
      }
      if (e.key === "Tab") {
        const focusables = dialogRef.current?.querySelectorAll<HTMLElement>("button");
        if (!focusables || focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hasMultiple, onClose, onPrev, onNext]);

  if (!mounted) return null;

  return createPortal(
    <div
      ref={dialogRef}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={image.title || image.alt || "Перегляд фото"}
    >
      <button
        ref={closeButtonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Закрити"
        className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 sm:right-6 sm:top-6"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {hasMultiple && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
          aria-label="Попереднє фото"
          className="absolute left-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 sm:left-6"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-6 w-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {hasMultiple && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          aria-label="Наступне фото"
          className="absolute right-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 sm:right-6"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-6 w-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      <img
        src={image.url}
        alt={image.alt ?? image.title ?? ""}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[100dvh] max-w-[100vw] object-contain"
      />

      {(image.title || image.category) && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 text-center sm:p-6">
          {image.title && <p className="text-sm font-semibold text-white sm:text-base">{image.title}</p>}
          {image.category && (
            <p className="mt-0.5 text-xs uppercase tracking-wide text-white/70">{image.category}</p>
          )}
        </div>
      )}
    </div>,
    document.body,
  );
}
