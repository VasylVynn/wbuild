"use client";

import type { ReactNode } from "react";

/**
 * Wraps one rendered block in the editor preview. The block itself is made
 * `pointer-events-none` and a transparent overlay button sits on top, so a tap
 * anywhere on the section opens its editor sheet instead of following links or
 * submitting the demo lead form inside the preview. A small always-visible bar
 * (label + reorder/hide/edit controls) rides on top — big tap targets for the
 * 50+ owner. Hidden sections collapse to a placeholder instead of full content.
 */

function ControlButton({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-lg text-neutral-700 shadow-md ring-1 ring-black/5 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export default function EditableSection({
  label,
  hidden,
  isFirst,
  isLast,
  onEdit,
  onMoveUp,
  onMoveDown,
  onToggleHidden,
  children,
}: {
  label: string;
  hidden: boolean;
  isFirst: boolean;
  isLast: boolean;
  onEdit: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleHidden: () => void;
  children: ReactNode;
}) {
  const controls = (
    <div className="flex items-center gap-1.5">
      <ControlButton title="Вгору" onClick={onMoveUp}>
        <span className={isFirst ? "opacity-30" : ""}>↑</span>
      </ControlButton>
      <ControlButton title="Вниз" onClick={onMoveDown}>
        <span className={isLast ? "opacity-30" : ""}>↓</span>
      </ControlButton>
      <ControlButton title={hidden ? "Показати" : "Приховати"} onClick={onToggleHidden}>
        {hidden ? "🙈" : "👁"}
      </ControlButton>
      <ControlButton title="Редагувати" onClick={onEdit}>
        ✏️
      </ControlButton>
    </div>
  );

  const labelChip = (
    <span className="pointer-events-none rounded-full bg-white/90 px-3 py-1 text-sm font-semibold text-neutral-800 shadow-md ring-1 ring-black/5 backdrop-blur">
      {label}
    </span>
  );

  if (hidden) {
    return (
      <div className="px-4 py-3">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-5 py-5">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-base font-semibold text-neutral-700">{label}</span>
              <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-xs font-medium text-neutral-600">
                приховано
              </span>
            </div>
            <span className="text-sm text-neutral-400">Ця секція не показується на сайті.</span>
          </div>
          {controls}
        </div>
      </div>
    );
  }

  return (
    <div className="group relative">
      {/* The block preview — non-interactive so taps hit the overlay, not links. */}
      <div className="pointer-events-none select-none">{children}</div>

      {/* Full-area tap target → open the editor sheet. */}
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Редагувати: ${label}`}
        className="absolute inset-0 z-10 cursor-pointer bg-transparent outline-none ring-inset transition group-hover:bg-black/[0.03] group-hover:ring-2 group-hover:ring-neutral-900/20"
      />

      {/* Always-visible label + controls. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between p-3">
        {labelChip}
        <div className="pointer-events-auto">{controls}</div>
      </div>
    </div>
  );
}
