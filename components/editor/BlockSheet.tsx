"use client";

import { useState } from "react";
import {
  getBlockFields,
  type AnyFieldDescriptor,
  type FieldDescriptor,
} from "@/lib/blocks/fields";
import type { StoredBlock } from "@/lib/blocks/schema";
import PhotoField from "./PhotoField";

/**
 * Bottom-sheet editor for ONE block. The form is generated from
 * `getBlockFields(type)` (§4.1 — the same registry drives render + validation +
 * this form, so they cannot drift). We never hand-code per-block forms. Editing
 * happens on a local draft of the props; «Зберегти» hands the whole props object
 * back to the shell, which persists the full blocks array.
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
        <select
          value={value}
          onChange={(e) => onValue(e.target.value)}
          className="min-h-12 w-full rounded-xl border border-neutral-300 bg-white px-4 text-base text-neutral-900 focus:border-neutral-900 focus:outline-none"
        >
          {(field.options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {ENUM_LABELS[opt] ?? opt}
            </option>
          ))}
        </select>
      );
    }
    if (field.kind === "textarea") {
      return (
        <textarea
          value={value}
          onChange={(e) => onValue(e.target.value)}
          rows={4}
          className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-base text-neutral-900 focus:border-neutral-900 focus:outline-none"
        />
      );
    }
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => onValue(e.target.value)}
        className="min-h-12 w-full rounded-xl border border-neutral-300 px-4 text-base text-neutral-900 focus:border-neutral-900 focus:outline-none"
      />
    );
  };

  const renderField = (field: AnyFieldDescriptor) => {
    if (field.kind === "array") {
      const items = getItems(field.key);
      return (
        <div key={field.key} className="flex flex-col gap-3">
          <span className="text-base font-semibold text-neutral-900">{field.label}</span>
          {items.map((item, index) => (
            <div
              key={index}
              className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-neutral-500">№ {index + 1}</span>
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
                  className="rounded-full px-3 py-1 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-40"
                >
                  Видалити
                </button>
              </div>
              {field.itemFields.map((itemField) => {
                const raw = item[itemField.key];
                const v = typeof raw === "string" ? raw : "";
                return (
                  <label key={itemField.key} className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-neutral-700">{itemField.label}</span>
                    {renderScalar(
                      itemField,
                      v,
                      (val) => setItemField(field.key, index, itemField.key, val),
                      {
                        set: (url) => setItemField(field.key, index, itemField.key, url),
                        clear: () => setItemField(field.key, index, itemField.key, ""),
                      },
                    )}
                  </label>
                );
              })}
            </div>
          ))}
          <button
            type="button"
            onClick={() => setItems(field.key, [...items, emptyItem(field.itemFields)])}
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-dashed border-neutral-400 px-5 text-base font-medium text-neutral-700 transition hover:bg-neutral-100"
          >
            + Додати
          </button>
        </div>
      );
    }

    return (
      <label key={field.key} className="flex flex-col gap-1.5">
        <span className="text-base font-medium text-neutral-800">{field.label}</span>
        {renderScalar(
          field,
          scalarValue(field.key),
          (val) => setScalar(field.key, val),
          {
            set: (url) => setScalar(field.key, url),
            clear: () => setScalar(field.key, ""),
          },
        )}
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
        className="absolute inset-0 h-full w-full bg-black/40"
      />
      {/* sheet */}
      <div className="absolute inset-x-0 bottom-0 z-50 mx-auto flex max-h-[85vh] max-w-2xl flex-col rounded-t-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-neutral-400">
              Редагування секції
            </div>
            <div className="text-lg font-semibold text-neutral-900">{label}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-2xl text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
            aria-label="Закрити"
          >
            ×
          </button>
        </div>

        <div className="flex flex-col gap-5 overflow-auto px-5 py-6">
          {fields.length === 0 ? (
            <p className="text-base text-neutral-500">Ця секція не має полів для редагування.</p>
          ) : (
            fields.map(renderField)
          )}
        </div>

        <div className="flex gap-3 border-t border-neutral-100 px-5 py-4">
          <button
            type="button"
            disabled={saving}
            onClick={() => onSave(draft)}
            className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full bg-neutral-900 px-5 text-base font-semibold text-white transition hover:bg-neutral-700 disabled:opacity-50"
          >
            {saving ? "Зберігаємо…" : "Зберегти"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-neutral-300 px-6 text-base font-medium text-neutral-700 transition hover:bg-neutral-100"
          >
            Скасувати
          </button>
        </div>
      </div>
    </div>
  );
}
