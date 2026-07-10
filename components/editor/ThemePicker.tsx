"use client";

import { themePresets } from "@/lib/theme/presets";
import { designPacks } from "@/lib/design/packs";
import type { Theme } from "@/lib/theme/tokens";
import { Sheet } from "@/components/ui";

/**
 * Design picker — the editor's primary «Оформлення» control. Theme lives
 * SEPARATELY from content (§4.5). The main section swaps a whole DESIGN PACK
 * (theme + every section's look at once); a secondary, collapsed «Лише палітра»
 * section keeps the palette-only presets for owners who just want to recolor a
 * pack. Both persist the draft server-side immediately (the shell handles the
 * call). Each card previews its palette with colour dots.
 */

export default function ThemePicker({
  options,
  currentTheme,
  currentPackId,
  pending,
  onPick,
  onPickPack,
  onClose,
}: {
  options: { id: string; label: string }[];
  currentTheme: Theme;
  currentPackId?: string;
  pending: boolean;
  onPick: (id: string) => void;
  onPickPack: (id: string) => void;
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

      {/* Primary — whole design packs (theme + section looks together). */}
      <h3 className="text-[15px] font-extrabold text-ink">Дизайн</h3>
      <p className="mt-0.5 mb-3 text-[14px] font-semibold text-ink-faint">
        Готові набори: кольори, шрифти та вигляд секцій разом.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {designPacks.map((pack) => {
          const colors = themePresets[pack.themePresetId]?.theme.colors;
          const selected = pack.id === currentPackId;
          return (
            <button
              key={pack.id}
              type="button"
              disabled={pending}
              onClick={() => onPickPack(pack.id)}
              className={`flex flex-col gap-2 rounded-[18px] p-[18px] text-left transition-colors disabled:opacity-60 ${
                selected
                  ? "border-2 border-brand ring-[3px] ring-brand-soft"
                  : "border-[1.5px] border-line hover:border-line-strong hover:bg-canvas"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-[17px] font-extrabold text-ink">{pack.label}</span>
                {colors && (
                  <span className="flex shrink-0 items-center gap-1.5">
                    {[colors.primary, colors.accent, colors.muted, colors.background].map((c, i) => (
                      <span
                        key={i}
                        className="h-6 w-6 rounded-full ring-1 ring-black/10"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </span>
                )}
              </div>
              <span className="text-[14px] font-semibold text-ink-muted">
                {selected ? "Зараз обрано · " : ""}
                {pack.description}
              </span>
            </button>
          );
        })}
      </div>

      {/* Secondary — palette-only recolor, kept out of the way. */}
      <details className="group mt-6 rounded-[18px] border-[1.5px] border-line">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-[18px] text-[15px] font-extrabold text-ink [&::-webkit-details-marker]:hidden">
          <span>Лише палітра</span>
          <span aria-hidden className="text-[14px] text-ink-faint transition-transform group-open:rotate-180">
            ▾
          </span>
        </summary>
        <div className="px-[18px] pb-[18px]">
          <p className="mb-3 text-[14px] font-semibold text-ink-faint">
            Змінити лише кольори, не чіпаючи вигляд секцій.
          </p>
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
                  className={`flex items-center justify-between gap-3 rounded-[16px] p-4 text-left transition-colors disabled:opacity-60 ${
                    selected
                      ? "border-2 border-brand ring-[3px] ring-brand-soft"
                      : "border-[1.5px] border-line hover:border-line-strong hover:bg-canvas"
                  }`}
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="text-[16px] font-extrabold text-ink">{opt.label}</span>
                    <span className="text-[13px] font-semibold text-ink-muted">
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
        </div>
      </details>
    </Sheet>
  );
}
