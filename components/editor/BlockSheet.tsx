"use client";

import type { StoredBlock } from "@/lib/blocks/schema";
import BlockEditPanel from "./BlockEditPanel";

/**
 * Mobile container for the block editor (P2): bottom sheet with drag handle,
 * eyebrow + title, backdrop. The actual form lives in BlockEditPanel — the
 * desktop inspector renders the same panel inside EditorShell's right column.
 */
export default function BlockSheet({
  block,
  label,
  host,
  saving,
  onSave,
  onSkinChange,
  onClose,
}: {
  block: StoredBlock;
  label: string;
  host: string;
  saving: boolean;
  onSave: (props: unknown) => void;
  onSkinChange?: (skin: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40">
      {/* backdrop */}
      <button
        type="button"
        aria-label="Закрити"
        onClick={onClose}
        className="absolute inset-0 h-full w-full bg-ink/40"
      />
      {/* sheet */}
      <div className="absolute inset-x-0 bottom-0 z-50 mx-auto flex max-h-[90vh] max-w-2xl flex-col rounded-t-[28px] bg-surface shadow-[0_-12px_44px_rgba(23,36,47,.25)] [&>div:last-child]:pb-6">
        <div className="flex justify-center pt-2.5 pb-0.5">
          <div className="h-1.5 w-11 rounded-full bg-line-strong" />
        </div>
        <div className="flex items-center justify-between border-b border-sunken px-5 pb-3.5 pt-1">
          <div>
            <div className="text-[12px] font-extrabold uppercase tracking-[0.08em] text-ink-faint">
              Редагування секції
            </div>
            <div className="font-brand text-[19px] font-medium text-ink">{label}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-[22px] text-ink-faint transition-colors hover:bg-sunken hover:text-ink"
            aria-label="Закрити"
          >
            ×
          </button>
        </div>

        <BlockEditPanel
          block={block}
          host={host}
          saving={saving}
          onSave={onSave}
          onSkinChange={onSkinChange}
          onClose={onClose}
        />
      </div>
    </div>
  );
}
