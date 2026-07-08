"use client";

/**
 * 3minsite UI primitives — direction B «Небо і мед» (design/CLAUDE.md + Components.dc.html).
 * The ONLY building blocks for product screens (dashboard, chat, editor chrome).
 * Rules baked in: min 48px tap targets, 17px base, pill/16px controls, AA contrast.
 */

import { useEffect, type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes } from "react";

// ── Button ───────────────────────────────────────────────────────────────────
type BtnVariant = "primary" | "secondary" | "quiet" | "telegram" | "danger";
const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-[16px] font-ui font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed select-none";
const btnVariants: Record<BtnVariant, string> = {
  primary: "bg-brand text-white hover:bg-brand-hover",
  secondary: "bg-surface text-ink border-[1.5px] border-line-strong hover:bg-sunken",
  quiet: "bg-transparent text-ink-muted hover:bg-sunken",
  telegram: "bg-tg text-white hover:bg-tg-dark",
  danger: "bg-danger-soft text-danger hover:bg-danger hover:text-white",
};
const btnSizes = {
  lg: "min-h-14 px-7 text-[18px]",
  md: "min-h-12 px-5 text-[16px]",
  sm: "min-h-10 px-4 text-[15px]",
};
export function Button({
  variant = "primary",
  size = "lg",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: keyof typeof btnSizes }) {
  return <button className={`${btnBase} ${btnVariants[variant]} ${btnSizes[size]} ${className}`} {...props} />;
}

// ── Fields ───────────────────────────────────────────────────────────────────
const fieldBase =
  "w-full rounded-[14px] border bg-surface px-4 py-3.5 text-[17px] text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand-soft focus:border-brand transition-shadow";
const fieldBorder = (error?: boolean) => (error ? "border-danger bg-danger-soft/30" : "border-line-strong");

export function Field({ label, error, children }: { label?: string; error?: string; children: ReactNode }) {
  return (
    <label className="flex w-full flex-col gap-1.5">
      {label && <span className="text-[15px] font-semibold text-ink">{label}</span>}
      {children}
      {error && <span className="text-[14px] text-danger">{error}</span>}
    </label>
  );
}
export function Input({ error, className = "", ...props }: InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) {
  return <input className={`${fieldBase} ${fieldBorder(error)} min-h-12 ${className}`} {...props} />;
}
export function Textarea({ error, className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean }) {
  return <textarea className={`${fieldBase} ${fieldBorder(error)} resize-none ${className}`} {...props} />;
}
export function Select({ error, className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement> & { error?: boolean }) {
  return <select className={`${fieldBase} ${fieldBorder(error)} min-h-12 ${className}`} {...props} />;
}

// ── Chip / status badge ──────────────────────────────────────────────────────
type ChipTone = "ok" | "warn" | "danger" | "neutral" | "brand" | "honey" | "tg";
const chipTones: Record<ChipTone, string> = {
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  neutral: "bg-sunken text-ink-muted",
  brand: "bg-brand-soft text-brand",
  honey: "bg-honey-soft text-honey-text",
  tg: "bg-[#E4F4FB] text-tg-dark",
};
export function Chip({ tone = "neutral", className = "", children }: { tone?: ChipTone; className?: string; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[13px] font-bold ${chipTones[tone]} ${className}`}>
      {children}
    </span>
  );
}

// ── Card ─────────────────────────────────────────────────────────────────────
export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-[20px] border border-line bg-surface shadow-card ${className}`}>{children}</div>;
}

// ── Bottom sheet ─────────────────────────────────────────────────────────────
export function Sheet({ open, onClose, children, title }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <button aria-label="Закрити" className="absolute inset-0 h-full w-full bg-ink/40" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-t-[28px] bg-surface p-6 pb-8 shadow-card">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-line-strong" />
        {title && <h3 className="mb-4 font-ui text-[19px] font-bold text-ink">{title}</h3>}
        {children}
      </div>
    </div>
  );
}

// ── Confirm dialog ───────────────────────────────────────────────────────────
export function ConfirmDialog({
  open, title, body, confirmLabel, cancelLabel = "Скасувати", onConfirm, onCancel, busy,
}: {
  open: boolean; title: string; body?: string; confirmLabel: string; cancelLabel?: string;
  onConfirm: () => void; onCancel: () => void; busy?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <button aria-label="Закрити" className="absolute inset-0 h-full w-full bg-ink/40" onClick={onCancel} />
      <div className="relative w-full max-w-sm rounded-[20px] bg-surface p-6 shadow-card">
        <h3 className="text-[19px] font-bold text-ink">{title}</h3>
        {body && <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">{body}</p>}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
          <Button size="md" onClick={onConfirm} disabled={busy} className="sm:flex-1">{busy ? "Зачекайте…" : confirmLabel}</Button>
          <Button size="md" variant="secondary" onClick={onCancel} disabled={busy} className="sm:flex-1">{cancelLabel}</Button>
        </div>
      </div>
    </div>
  );
}

// ── Toast (presentational; screens manage state) ────────────────────────────
export function Toast({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div className="pointer-events-auto fixed bottom-6 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center justify-between gap-3 rounded-[16px] bg-ink px-5 py-4 text-[15px] font-semibold text-white shadow-card">
      <span>{message}</span>
      {action}
    </div>
  );
}

// ── Empty state ──────────────────────────────────────────────────────────────
export function EmptyState({ emoji, title, children }: { emoji: string; title: string; children?: ReactNode }) {
  return (
    <div className="rounded-[20px] border border-dashed border-line-strong px-6 py-14 text-center">
      <div className="text-4xl">{emoji}</div>
      <p className="mt-3 text-[17px] font-semibold text-ink">{title}</p>
      {children && <div className="mt-1 text-[15px] text-ink-muted">{children}</div>}
    </div>
  );
}

// ── Wordmark ─────────────────────────────────────────────────────────────────
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`select-none font-brand text-[20px] font-semibold tracking-tight text-ink ${className}`}>
      <span className="text-honey">3</span>minsite
    </span>
  );
}
