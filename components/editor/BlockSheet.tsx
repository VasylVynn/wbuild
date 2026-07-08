"use client";

import { useState } from "react";
import {
  getBlockFields,
  type AnyFieldDescriptor,
  type FieldDescriptor,
} from "@/lib/blocks/fields";
import type { StoredBlock } from "@/lib/blocks/schema";
import { Button, Input, Select, Textarea } from "@/components/ui";
import PhotoField from "./PhotoField";

/**
 * Bottom-sheet editor for ONE block. The form is generated from
 * `getBlockFields(type)` (§4.1 — the same registry drives render + validation +
 * this form, so they cannot drift). We never hand-code per-block forms. Editing
 * happens on a local draft of the props; «Зберегти» hands the whole props object
 * back to the shell, which persists the full blocks array. Styled to the
 * «Небо і мед» sheet (design G): drag handle, eyebrow + title, sticky footer.
 */

// Ukrainian labels for the few enum values we edit via <select>.
const ENUM_LABELS: Record<string, string> = {
  left: "Ліворуч",
  center: "По центру",
  right: "Праворуч",
};

type Item = Record<string, unknown>;
type Draft = Record<string, unknown>;

function emptyItem(itemFields: FieldDescriptor[]): Item {
  return Object.fromEntries(itemFields.map((f) => [f.key, ""]));
}

export default function BlockSheet({
  block,
  label,
  host,
  saving,
  onSave,
  onClose,
}: {
  block: StoredBlock;
  label: string;
  host: string;
  saving: boolean;
  onSave: (props: unknown) => void;
  onClose: () => void;
}) {
  const fields = getBlockFields(block.type);
  const [draft, setDraft] = useState<Draft>(() =>
    JSON.parse(JSON.stringify(block.props)) as Draft,
  );

  const setScalar = (key: string, value: unknown) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const getItems = (key: string): Item[] =>
    Array.isArray(draft[key]) ? (draft[key] as Item[]) : [];

  const setItems = (key: string, items: Item[]) =>
    setDraft((d) => ({ ...d, [key]: items }));

  const setItemField = (key: string, index: number, itemKey: string, value: unknown) => {
    const items = getItems(key).slice();
    items[index] = { ...items[index], [itemKey]: value };
    setItems(key, items);
  };

  const scalarValue = (key: string): string =>
    typeof draft[key] === "string" ? (draft[key] as string) : "";

  const renderScalar = (
    field: FieldDescriptor,
    value: string,
    onValue: (v: string) => void,
    onImage: { set: (url: string) => void; clear: () => void },
  ) => {
    if (field.kind === "image") {
      return (
        <PhotoField value={value || undefined} host={host} onChange={onImage.set} onClear={onImage.clear} />
      );
    }
    if (field.kind === "select") {
      return (
        <Select value={value} onChange={(e) => onValue(e.target.value)}>
          {(field.options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {ENUM_LABELS[opt] ?? opt}
            </option>
          ))}
        </Select>
      );
    }
    if (field.kind === "textarea") {
      return (
        <Textarea value={value} onChange={(e) => onValue(e.target.value)} rows={4} />
      );
    }
    return <Input type="text" value={value} onChange={(e) => onValue(e.target.value)} />;
  };

  const renderField = (field: AnyFieldDescriptor) => {
    if (field.kind === "array") {
      const items = getItems(field.key);
      return (
        <div key={field.key} className="flex flex-col gap-3">
          <span className="text-[15px] font-semibold text-ink">{field.label}</span>
          {items.map((item, index) => (
            <div
              key={index}
              className="flex flex-col gap-3 rounded-[16px] border border-line bg-canvas p-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-bold text-ink-faint">№ {index + 1}</span>
                <button
                  type="button"
                  disabled={items.length <= 1}
                  title={items.length <= 1 ? "Має лишитися хоча б один" : "Видалити"}
                  onClick={() =>
                    setItems(
                      field.key,
                      items.filter((_, i) => i !== index),
                    )
                  }
                  className="rounded-full px-3 py-1 text-[14px] font-bold text-danger transition-colors hover:bg-danger-soft disabled:opacity-40"
                >
                  Видалити
                </button>
              </div>
              {field.itemFields.map((itemField) => {
                const raw = item[itemField.key];
                const v = typeof raw === "string" ? raw : "";
                const control = renderScalar(
                  itemField,
                  v,
                  (val) => setItemField(field.key, index, itemField.key, val),
                  {
                    set: (url) => setItemField(field.key, index, itemField.key, url),
                    clear: () => setItemField(field.key, index, itemField.key, ""),
                  },
                );
                const inner = (
                  <>
                    <span className="text-[14px] font-semibold text-ink-muted">
                      {itemField.label}
                    </span>
                    {control}
                  </>
                );
                // Image controls contain buttons → don't nest them in a <label>.
                return itemField.kind === "image" ? (
                  <div key={itemField.key} className="flex flex-col gap-1.5">
                    {inner}
                  </div>
                ) : (
                  <label key={itemField.key} className="flex flex-col gap-1.5">
                    {inner}
                  </label>
                );
              })}
            </div>
          ))}
          <button
            type="button"
            onClick={() => setItems(field.key, [...items, emptyItem(field.itemFields)])}
            className="inline-flex min-h-12 items-center justify-center rounded-full border-2 border-dashed border-line-strong px-5 text-[16px] font-semibold text-ink-muted transition-colors hover:border-brand hover:bg-brand-soft hover:text-brand"
          >
            + Додати
          </button>
        </div>
      );
    }

    const control = renderScalar(
      field,
      scalarValue(field.key),
      (val) => setScalar(field.key, val),
      {
        set: (url) => setScalar(field.key, url),
        clear: () => setScalar(field.key, ""),
      },
    );
    const inner = (
      <>
        <span className="text-[15px] font-semibold text-ink">{field.label}</span>
        {control}
      </>
    );
    // Image controls contain buttons → don't nest them in a <label>.
    return field.kind === "image" ? (
      <div key={field.key} className="flex flex-col gap-2">
        {inner}
      </div>
    ) : (
      <label key={field.key} className="flex flex-col gap-2">
        {inner}
      </label>
    );
  };

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
      <div className="absolute inset-x-0 bottom-0 z-50 mx-auto flex max-h-[90vh] max-w-2xl flex-col rounded-t-[28px] bg-surface shadow-[0_-12px_44px_rgba(23,36,47,.25)]">
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
            className="flex h-11 w-11 items-center justify-center rounded-full text-[22px] text-ink-faint transition-colors hover:bg-sunken hover:text-ink"
            aria-label="Закрити"
          >
            ×
          </button>
        </div>

        <div className="flex flex-col gap-5 overflow-auto px-5 py-6">
          {fields.length === 0 ? (
            <p className="text-[16px] text-ink-muted">Ця секція не має полів для редагування.</p>
          ) : (
            fields.map(renderField)
          )}
        </div>

        <div className="flex gap-3 border-t border-sunken px-5 py-4 pb-6">
          <Button
            size="md"
            disabled={saving}
            onClick={() => onSave(draft)}
            className="flex-[1.4]"
          >
            {saving ? "Зберігаємо…" : "Зберегти"}
          </Button>
          <Button size="md" variant="secondary" onClick={onClose} className="flex-1">
            Скасувати
          </Button>
        </div>
      </div>
    </div>
  );
}
