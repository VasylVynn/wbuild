"use client";

import type { ReactNode } from "react";
import { ArrowUp, ArrowDown, Eye, EyeOff, Pencil } from "lucide-react";

/**
 * Wraps one rendered block in the editor preview. The block itself is made
 * `pointer-events-none` and a transparent overlay button sits on top, so a tap
 * anywhere on the section opens its editor sheet instead of following links or
 * submitting the demo lead form inside the preview. An always-visible label +
 * reorder/hide/edit bar rides on top. Hidden sections collapse to a labelled
 * dashed placeholder instead of rendering their full content.
 */

type CtrlVariant = "float" | "inline" | "brand";
const ctrlVariants: Record<CtrlVariant, string> = {
  // Floats over the themed preview → white pill with a soft drop shadow.
  float: "bg-surface text-ink shadow-[0_2px_8px_rgba(23,36,47,.18)] hover:bg-brand-soft",
  // Sits inside the neutral placeholder card → white pill with a hairline.
  inline: "bg-surface text-ink border border-line hover:bg-brand-soft",
  // The primary "edit" affordance → solid brand blue.
  brand: "bg-brand text-white shadow-[0_2px_8px_rgba(23,36,47,.18)] hover:bg-brand-hover",
};

function ControlButton({
  onClick,
  title,
  variant = "float",
  children,
}: {
  onClick: () => void;
  title: string;
  variant?: CtrlVariant;
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
      className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${ctrlVariants[variant]}`}
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
  const controls = (variant: "float" | "inline") => (
    <div className="flex items-center gap-1.5">
      <ControlButton title="Вгору" variant={variant} onClick={onMoveUp}>
        <ArrowUp size={16} className={isFirst ? "opacity-30" : ""} />
      </ControlButton>
      <ControlButton title="Вниз" variant={variant} onClick={onMoveDown}>
        <ArrowDown size={16} className={isLast ? "opacity-30" : ""} />
      </ControlButton>
      <ControlButton
        title={hidden ? "Показати" : "Приховати"}
        variant={variant}
        onClick={onToggleHidden}
      >
        {hidden ? <EyeOff size={16} /> : <Eye size={16} />}
      </ControlButton>
      <ControlButton
        title="Редагувати"
        variant={variant === "inline" ? "inline" : "brand"}
        onClick={onEdit}
      >
        <Pencil size={15} />
      </ControlButton>
    </div>
  );

  if (hidden) {
    return (
      <div className="bg-surface px-4 py-3">
        <div className="flex items-center justify-between gap-3 rounded-[16px] border-2 border-dashed border-line-strong bg-canvas px-5 py-4">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-[16px] font-extrabold text-ink-muted">{label}</span>
              <span className="shrink-0 rounded-full bg-sunken px-2.5 py-0.5 text-[12px] font-bold text-ink-faint">
                приховано
              </span>
            </div>
            <span className="text-[14px] font-semibold text-ink-faint">
              Ця секція не показується на сайті.
            </span>
          </div>
          {controls("inline")}
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
        className="absolute inset-0 z-10 cursor-pointer bg-transparent outline-none ring-inset transition group-hover:bg-brand/[0.04] group-hover:ring-2 group-hover:ring-brand/30 focus-visible:bg-brand/[0.04] focus-visible:ring-2 focus-visible:ring-brand/50"
      />

      {/* Always-visible label + controls. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between p-3">
        <span className="pointer-events-none rounded-full bg-surface/95 px-3.5 py-1 text-[14px] font-extrabold text-ink shadow-[0_2px_8px_rgba(23,36,47,.15)] backdrop-blur">
          {label}
        </span>
        <div className="pointer-events-auto">{controls("float")}</div>
      </div>
    </div>
  );
}
