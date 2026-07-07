"use client";

import { useRef, useState, type ComponentType } from "react";
import Link from "next/link";
import {
  saveDraftBlocks,
  switchTheme,
  regenerateSite,
  publishSite,
  type EditorData,
} from "@/app/app/edit/actions";
import { blockRegistry } from "@/lib/blocks/registry";
import { blockLibrary } from "@/lib/blocks/library";
import type { StoredBlock } from "@/lib/blocks/schema";
import { themeToCssVars, type Theme } from "@/lib/theme/tokens";
import EditableSection from "./EditableSection";
import BlockSheet from "./BlockSheet";
import ThemePicker from "./ThemePicker";

/**
 * The site EDITOR (§3): the owner sees their DRAFT rendered with the live theme,
 * taps a section to edit its fields, reorders/hides sections, swaps the design
 * preset, regenerates from facts, and publishes. All chrome is calm neutral
 * dashboard styling wrapped around the themed preview; everything is Ukrainian
 * and tuned for a non-technical 50+ owner (big tap targets, plain wording).
 */

const STATUS: Record<string, { label: string; cls: string }> = {
  published: { label: "Опубліковано", cls: "bg-green-100 text-green-800" },
  draft: { label: "Чернетка", cls: "bg-amber-100 text-amber-800" },
  demo: { label: "Демо", cls: "bg-neutral-100 text-neutral-600" },
  suspended: { label: "Призупинено", cls: "bg-red-100 text-red-700" },
};

// Render one block via the shared registry. The registry value is keyed to its
// own props type; for a dynamic block we widen the component to accept the
// stored props object (validation already happened server-side).
function BlockView({ block }: { block: StoredBlock }) {
  const Comp = blockRegistry[block.type] as unknown as ComponentType<{ data: unknown }>;
  return <Comp data={block.props} />;
}

type Toast = { text: string; href?: string };

/** Immutably patch a stored block (props and/or hidden), keeping its type. */
function patchBlock(
  block: StoredBlock,
  patch: Partial<{ props: unknown; hidden: boolean }>,
): StoredBlock {
  return { ...block, ...patch } as unknown as StoredBlock;
}

export default function EditorShell({ initial }: { initial: EditorData }) {
  const { host } = initial;
  const [blocks, setBlocks] = useState<StoredBlock[]>(initial.blocks);
  const [theme, setTheme] = useState<Theme>(initial.theme);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [themeOpen, setThemeOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [busyLabel, setBusyLabel] = useState<string | null>(null); // theme / regenerate
  const [dirty, setDirty] = useState(false); // unpublished draft changes
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = (t: Toast) => {
    setToast(t);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), t.href ? 8000 : 3500);
  };

  // Persist the full blocks array to the draft (never purges cache — §5.5).
  const persist = async (next: StoredBlock[], successToast?: string): Promise<boolean> => {
    setSaving(true);
    const res = await saveDraftBlocks(host, next);
    setSaving(false);
    if (!res.ok) {
      notify({ text: `Не вдалося зберегти: ${res.error ?? "помилка"}` });
      return false;
    }
    if (successToast) notify({ text: successToast });
    return true;
  };

  const handleSaveBlock = async (index: number, props: unknown) => {
    const next = blocks.map((b, i) => (i === index ? patchBlock(b, { props }) : b));
    setBlocks(next);
    setDirty(true);
    const ok = await persist(next, "Чернетку збережено");
    if (ok) setSelectedIndex(null);
  };

  const move = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= blocks.length) return;
    const next = blocks.slice();
    [next[index], next[j]] = [next[j], next[index]];
    setBlocks(next);
    setDirty(true);
    void persist(next);
  };

  const toggleHidden = (index: number) => {
    const next = blocks.map((b, i) => (i === index ? patchBlock(b, { hidden: !b.hidden }) : b));
    setBlocks(next);
    setDirty(true);
    void persist(next);
  };

  const pickTheme = async (id: string) => {
    setBusyLabel("theme");
    const res = await switchTheme(host, id);
    setBusyLabel(null);
    if (res.ok && res.theme) {
      setTheme(res.theme);
      setDirty(true);
      setThemeOpen(false);
      notify({ text: "Оформлення змінено" });
    } else {
      notify({ text: `Не вдалося змінити оформлення: ${res.error ?? "помилка"}` });
    }
  };

  const regenerate = async () => {
    if (
      !window.confirm(
        "Зібрати сайт наново з ваших даних? Поточна версія збережеться в чернетках.",
      )
    ) {
      return;
    }
    setBusyLabel("regenerate");
    const res = await regenerateSite(host);
    setBusyLabel(null);
    if (res.ok && res.blocks) {
      setBlocks(res.blocks);
      if (res.theme) setTheme(res.theme);
      setDirty(true);
      notify({ text: "Сайт зібрано наново" });
    } else {
      notify({ text: `Не вдалося перегенерувати: ${res.error ?? "помилка"}` });
    }
  };

  const publish = async () => {
    setPublishing(true);
    const res = await publishSite(host);
    setPublishing(false);
    if (res.ok) {
      const url = `${location.protocol}//${host}${
        location.port && location.hostname.endsWith("lvh.me") ? ":" + location.port : ""
      }`;
      setDirty(false);
      notify({ text: "Опубліковано! Зміни вже на сайті", href: url });
    } else {
      notify({ text: `Не вдалося опублікувати: ${res.error ?? "помилка"}` });
    }
  };

  const status = STATUS[initial.status] ?? STATUS.draft;
  const regenerating = busyLabel === "regenerate";
  const themeBusy = busyLabel === "theme";
  const selected = selectedIndex != null ? blocks[selectedIndex] : null;

  const previewStyle = {
    ...themeToCssVars(theme),
    backgroundColor: "var(--color-background)",
    color: "var(--color-foreground)",
    fontFamily: "var(--font-body)",
  };

  return (
    <div className="min-h-screen bg-neutral-100">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/sites"
              className="shrink-0 text-sm text-neutral-500 transition hover:text-neutral-800"
            >
              ← Сайти
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-lg font-semibold text-neutral-900">
                  {initial.businessName}
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${status.cls}`}
                >
                  {status.label}
                </span>
              </div>
              <div className="truncate text-xs text-neutral-400">
                {host}
                {dirty && <span className="ml-2 text-amber-600">• є неопубліковані зміни</span>}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setThemeOpen(true)}
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-neutral-300 px-4 text-sm font-medium text-neutral-800 transition hover:bg-neutral-100"
            >
              🎨 Оформлення
            </button>
            <button
              type="button"
              disabled={regenerating}
              onClick={regenerate}
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-neutral-300 px-4 text-sm font-medium text-neutral-800 transition hover:bg-neutral-100 disabled:opacity-50"
            >
              {regenerating ? "Збираємо…" : "↻ Перегенерувати"}
            </button>
            <button
              type="button"
              disabled={publishing}
              onClick={publish}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-neutral-900 px-5 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:opacity-50"
            >
              {publishing ? "Публікуємо…" : "Опублікувати"}
            </button>
          </div>
        </div>
      </header>

      {/* Draft preview */}
      <main className="mx-auto max-w-5xl px-2 py-4 sm:px-4 sm:py-6">
        <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
          {blocks.length === 0 ? (
            <div className="px-6 py-24 text-center text-neutral-400">
              Тут поки порожньо. Натисніть «Перегенерувати», щоб зібрати сайт із ваших даних.
            </div>
          ) : (
            <div style={previewStyle}>
              {blocks.map((block, index) => (
                <EditableSection
                  key={index}
                  label={blockLibrary[block.type]?.label ?? block.type}
                  hidden={!!block.hidden}
                  isFirst={index === 0}
                  isLast={index === blocks.length - 1}
                  onEdit={() => setSelectedIndex(index)}
                  onMoveUp={() => move(index, -1)}
                  onMoveDown={() => move(index, 1)}
                  onToggleHidden={() => toggleHidden(index)}
                >
                  <BlockView block={block} />
                </EditableSection>
              ))}
            </div>
          )}
        </div>
        <p className="mx-auto mt-4 max-w-md text-center text-sm text-neutral-400">
          Натисніть на будь-яку секцію, щоб змінити текст або фото. Зміни зберігаються в чернетку —
          натисніть «Опублікувати», щоб вони зʼявились на сайті.
        </p>
      </main>

      {selected && selectedIndex != null && (
        <BlockSheet
          key={selectedIndex}
          block={selected}
          label={blockLibrary[selected.type]?.label ?? selected.type}
          host={host}
          saving={saving}
          onSave={(props) => void handleSaveBlock(selectedIndex, props)}
          onClose={() => setSelectedIndex(null)}
        />
      )}

      {themeOpen && (
        <ThemePicker
          options={initial.themeOptions}
          currentTheme={theme}
          pending={themeBusy}
          onPick={(id) => void pickTheme(id)}
          onClose={() => setThemeOpen(false)}
        />
      )}

      {toast && (
        <div className="fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4">
          <div className="flex items-center gap-3 rounded-full bg-neutral-900 px-5 py-3 text-sm font-medium text-white shadow-xl">
            <span>{toast.text}</span>
            {toast.href && (
              <a
                href={toast.href}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-white/20 px-3 py-1 font-semibold transition hover:bg-white/30"
              >
                Відкрити ↗
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
