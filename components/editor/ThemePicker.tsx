"use client";

import { themePresets } from "@/lib/theme/presets";
import type { Theme } from "@/lib/theme/tokens";

/**
 * Theme (design) switcher — a sheet of tappable preset cards. Theme lives
 * SEPARATELY from content (§4.5): picking one swaps only the design tokens and
 * saves the draft theme server-side immediately (the shell handles the call).
 * Each card previews the palette with three colour dots.
 */

export default function ThemePicker({
  options,
  currentTheme,
  pending,
  onPick,
  onClose,
}: {
  options: { id: string; label: string }[];
  currentTheme: Theme;
  pending: boolean;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40">
      <button
        type="button"
        aria-label="Закрити"
        onClick={onClose}
        className="absolute inset-0 h-full w-full bg-black/40"
      />
      <div className="absolute inset-x-0 bottom-0 z-50 mx-auto flex max-h-[85vh] max-w-2xl flex-col rounded-t-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
          <div className="text-lg font-semibold text-neutral-900">Оформлення сайту</div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-2xl text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
            aria-label="Закрити"
          >
            ×
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 overflow-auto px-5 py-6 sm:grid-cols-2">
          {options.map((opt) => {
            const preset = themePresets[opt.id as keyof typeof themePresets];
            const colors = preset?.theme.colors;
            const selected =
              !!colors &&
              colors.primary === currentTheme.colors.primary &&
              colors.background === currentTheme.colors.background;
            return (
              <button
                key={opt.id}
                type="button"
                disabled={pending}
                onClick={() => onPick(opt.id)}
                className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-4 text-left transition disabled:opacity-60 ${
                  selected
                    ? "border-neutral-900 ring-2 ring-neutral-900"
                    : "border-neutral-200 hover:border-neutral-400"
                }`}
              >
                <span className="text-base font-medium text-neutral-900">{opt.label}</span>
                {colors && (
                  <span className="flex shrink-0 items-center gap-1.5">
                    {[colors.primary, colors.accent, colors.background].map((c, i) => (
                      <span
                        key={i}
                        className="h-6 w-6 rounded-full ring-1 ring-black/10"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
