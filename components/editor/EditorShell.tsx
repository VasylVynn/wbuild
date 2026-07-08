"use client";

import { useRef, useState, type ComponentType } from "react";
import Link from "next/link";
import {
  saveDraftBlocks,
  switchTheme,
  regenerateSite,
  publishSite,
  customRequestAction,
  type EditorData,
} from "@/app/app/(protected)/edit/actions";
import { blockRegistry } from "@/lib/blocks/registry";
import { blockLibrary } from "@/lib/blocks/library";
import type { StoredBlock } from "@/lib/blocks/schema";
import { themeToCssVars, type Theme } from "@/lib/theme/tokens";
import { Button, Card, Chip, ConfirmDialog, Sheet, Textarea, Toast } from "@/components/ui";
import EditableSection from "./EditableSection";
import BlockSheet from "./BlockSheet";
import ThemePicker from "./ThemePicker";

/**
 * The site EDITOR (§3): the owner sees their DRAFT rendered with the live theme,
 * taps a section to edit its fields, reorders/hides sections, swaps the design
 * preset, regenerates from facts, and publishes. The chrome is the calm neutral
 * «Небо і мед» product system (paper + blue) wrapped around the framed themed
 * preview so the two never clash; everything is Ukrainian and tuned for a
 * non-technical 50+ owner (big tap targets, plain wording).
 */

const STATUS_LABELS: Record<string, string> = {
  published: "Опубліковано",
  draft: "Чернетка",
  demo: "Демо",
  suspended: "Призупинено",
};
// Only the two happy states get a coloured chip; everything else stays neutral.
const statusTone = (s: string): "ok" | "warn" | "neutral" =>
  s === "published" ? "ok" : s === "draft" ? "warn" : "neutral";

// Render one block via the shared registry. The registry value is keyed to its
// own props type; for a dynamic block we widen the component to accept the
// stored props object (validation already happened server-side).
function BlockView({ block }: { block: StoredBlock }) {
  const Comp = blockRegistry[block.type] as unknown as ComponentType<{
    data: unknown;
    skin?: string;
  }>;
  return <Comp data={block.props} skin={block.skin} />;
}

type Toast = { text: string; href?: string };

/** Immutably patch a stored block (props and/or hidden), keeping its type. */
function patchBlock(
  block: StoredBlock,
  patch: Partial<{ props: unknown; hidden: boolean; skin: string }>,
): StoredBlock {
  return { ...block, ...patch } as unknown as StoredBlock;
}

export default function EditorShell({ initial }: { initial: EditorData }) {
  const { host } = initial;
  const [blocks, setBlocks] = useState<StoredBlock[]>(initial.blocks);
  const [theme, setTheme] = useState<Theme>(initial.theme);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [themeOpen, setThemeOpen] = useState(false);
  const [regenConfirmOpen, setRegenConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [busyLabel, setBusyLabel] = useState<string | null>(null); // theme / regenerate
  const [dirty, setDirty] = useState(false); // unpublished draft changes
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [customMessage, setCustomMessage] = useState("");
  const [customSubmitting, setCustomSubmitting] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);

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

  // Switch a block's layout skin (content untouched); mirrors hide/reorder —
  // update local state and persist to the draft, no save button needed.
  const handleSkinChange = (index: number, skin: string) => {
    const next = blocks.map((b, i) => (i === index ? patchBlock(b, { skin }) : b));
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

  // Rebuild the site from the owner's facts. Gated behind a confirm dialog; the
  // current draft is kept server-side, so nothing is lost (§5.5).
  const runRegenerate = async () => {
    setBusyLabel("regenerate");
    const res = await regenerateSite(host);
    setBusyLabel(null);
    setRegenConfirmOpen(false);
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

  const closeCustomSheet = () => {
    if (customSubmitting) return;
    setCustomOpen(false);
    setCustomError(null);
  };

  // «Хочу кастомні зміни» — quiet upsell channel (current-cycle п.5): free-text
  // request goes to the platform team, the owner just gets a thank-you.
  const submitCustomRequest = async () => {
    if (customSubmitting) return;
    setCustomSubmitting(true);
    setCustomError(null);
    try {
      const res = await customRequestAction(host, customMessage);
      if (res.ok) {
        setCustomOpen(false);
        setCustomMessage("");
        notify({ text: "Дякуємо! Ми звʼяжемось з вами найближчим часом." });
      } else {
        setCustomError(res.error ?? "Не вдалося надіслати. Спробуйте ще раз.");
      }
    } catch {
      // A thrown action (network drop) must not leave the button stuck busy.
      setCustomError("Не вдалося звʼязатися з сервером. Спробуйте ще раз.");
    } finally {
      setCustomSubmitting(false);
    }
  };

  const statusLabel = STATUS_LABELS[initial.status] ?? STATUS_LABELS.draft;
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
    <div className="min-h-screen bg-sunken font-ui text-ink">
      {/* Top bar — business + status, then design / regenerate / publish actions. */}
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/sites"
              className="flex shrink-0 items-center gap-1 text-[15px] font-bold text-ink-muted transition-colors hover:text-ink"
            >
              <span aria-hidden>←</span>
              <span className="hidden sm:inline">Сайти</span>
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-[17px] font-extrabold text-ink sm:text-[19px]">
                  {initial.businessName}
                </span>
                <Chip tone={statusTone(initial.status)} className="shrink-0">
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
                  {statusLabel}
                </Chip>
              </div>
              <div className="truncate text-[13px] font-semibold text-ink-faint">
                {host}
                {dirty && <span className="ml-2 text-warn">• є неопубліковані зміни</span>}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
            <Button
              variant="secondary"
              size="md"
              className="shrink-0 rounded-full"
              onClick={() => setThemeOpen(true)}
            >
              <span aria-hidden>🎨</span> Оформлення
            </Button>
            <Button
              variant="secondary"
              size="md"
              disabled={regenerating}
              className="shrink-0 rounded-full"
              onClick={() => setRegenConfirmOpen(true)}
            >
              <span aria-hidden>↻</span>
              <span className="hidden sm:inline">
                {regenerating ? "Збираємо…" : "Перегенерувати"}
              </span>
            </Button>
            <Button
              variant="primary"
              size="md"
              disabled={publishing}
              className="w-full rounded-full sm:w-auto"
              onClick={publish}
            >
              {publishing ? "Публікуємо…" : "Опублікувати"}
            </Button>
          </div>
        </div>
      </header>

      {/* Draft preview — the tenant theme renders inside a neutral white frame. */}
      <main className="mx-auto max-w-5xl px-2 py-4 sm:px-4 sm:py-6">
        <div className="overflow-hidden rounded-[24px] border border-line bg-surface shadow-card">
          {blocks.length === 0 ? (
            <div className="px-6 py-24 text-center text-[15px] font-medium text-ink-faint">
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
        <p className="mx-auto mt-4 max-w-md text-center text-[14px] font-semibold text-ink-faint">
          Натисніть на будь-яку секцію, щоб змінити текст або фото. Зміни зберігаються в чернетку —
          натисніть «Опублікувати», щоб вони зʼявились на сайті.
        </p>

        <Card className="mt-4 flex flex-col items-start gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[15px] font-semibold text-ink-muted">
            Потрібно щось особливе — інша структура, дизайн, додаткові сторінки?
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="w-full shrink-0 rounded-full sm:w-auto"
            onClick={() => setCustomOpen(true)}
          >
            Хочу кастомні зміни
          </Button>
        </Card>
      </main>

      {selected && selectedIndex != null && (
        <BlockSheet
          key={selectedIndex}
          block={selected}
          label={blockLibrary[selected.type]?.label ?? selected.type}
          host={host}
          saving={saving}
          onSave={(props) => void handleSaveBlock(selectedIndex, props)}
          onSkinChange={(skin) => handleSkinChange(selectedIndex, skin)}
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

      <Sheet open={customOpen} onClose={closeCustomSheet} title="Кастомні зміни">
        <p className="mb-4 text-[15px] leading-relaxed text-ink-muted">
          Опишіть, що ви хочете змінити чи додати — ми подивимось і звʼяжемось з вами.
        </p>
        <Textarea
          rows={4}
          value={customMessage}
          onChange={(e) => setCustomMessage(e.target.value)}
          placeholder="Напр.: хочу окрему сторінку для кожної послуги і власні кольори бренду"
          error={!!customError}
        />
        {customError && <p className="mt-2 text-[14px] text-danger">{customError}</p>}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
          <Button
            size="md"
            disabled={customSubmitting}
            className="sm:flex-1"
            onClick={() => void submitCustomRequest()}
          >
            {customSubmitting ? "Надсилаємо…" : "Надіслати запит"}
          </Button>
          <Button
            size="md"
            variant="quiet"
            disabled={customSubmitting}
            className="sm:flex-1"
            onClick={closeCustomSheet}
          >
            Скасувати
          </Button>
        </div>
      </Sheet>

      <ConfirmDialog
        open={regenConfirmOpen}
        title="Зібрати сайт наново з ваших даних?"
        body="Поточна версія збережеться в чернетках."
        confirmLabel="Так, зібрати"
        busy={regenerating}
        onConfirm={() => void runRegenerate()}
        onCancel={() => {
          if (!regenerating) setRegenConfirmOpen(false);
        }}
      />

      {toast && (
        <Toast
          message={toast.text}
          action={
            toast.href ? (
              <a
                href={toast.href}
                target="_blank"
                rel="noopener noreferrer"
                className="whitespace-nowrap rounded-full bg-white/20 px-4 py-2 font-bold text-white transition-colors hover:bg-white/30"
              >
                Переглянути сайт ↗
              </a>
            ) : undefined
          }
        />
      )}
    </div>
  );
}
