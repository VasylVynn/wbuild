"use client";

import { themePresets } from "@/lib/theme/presets";
import type { Theme } from "@/lib/theme/tokens";
import { Sheet } from "@/components/ui";

/**
 * Theme (design) switcher — a sheet of tappable preset cards. Theme lives
 * SEPARATELY from content (§4.5): picking one swaps only the design tokens and
 * saves the draft theme server-side immediately (the shell handles the call).
 * Each card shows the preset's mood and previews its palette with three dots.
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
    <Sheet open onClose={onClose}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-brand text-[19px] font-medium text-ink">Оформлення сайту</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрити"
          className="flex h-11 w-11 items-center justify-center rounded-full text-[22px] text-ink-faint transition-colors hover:bg-sunken hover:text-ink"
        >
          ×
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
              className={`flex items-center justify-between gap-3 rounded-[18px] p-[18px] text-left transition-colors disabled:opacity-60 ${
                selected
                  ? "border-2 border-brand ring-[3px] ring-brand-soft"
                  : "border-[1.5px] border-line hover:border-line-strong hover:bg-canvas"
              }`}
            >
              <div className="flex min-w-0 flex-col gap-1">
                <span className="text-[17px] font-extrabold text-ink">{opt.label}</span>
                <span className="text-[14px] font-semibold text-ink-muted">
                  {preset?.mood}
                  {selected && (preset?.mood ? " · " : "") + "зараз обрано"}
                </span>
              </div>
              {colors && (
                <span className="flex shrink-0 items-center gap-1.5">
                  {[colors.primary, colors.accent, colors.background].map((c, i) => (
                    <span
                      key={i}
                      className="h-7 w-7 rounded-full ring-1 ring-black/10"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
