"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import Link from "next/link";
import { Palette, ImageIcon, RefreshCw, Monitor, Tablet, Smartphone, Sparkles, Undo2 } from "lucide-react";
import {
  saveDraftBlocks,
  switchTheme,
  regenerateSite,
  publishSite,
  customRequestAction,
  type EditorData,
} from "@/app/app/(protected)/edit/actions";
import { switchDesignPack } from "@/app/app/(protected)/edit/design-actions";
import { getLogoAction, setLogoAction } from "@/app/app/(protected)/edit/logo-actions";
import { blockRegistry } from "@/lib/blocks/registry";
import { blockLibrary } from "@/lib/blocks/library";
import { getTemplate, type SiteTemplate } from "@/lib/templates/registry";
import type { StoredBlock } from "@/lib/blocks/schema";
import { themeToCssVars, type Theme } from "@/lib/theme/tokens";
import { Button, Card, Chip, ConfirmDialog, Sheet, Textarea, Toast } from "@/components/ui";
import EditableSection from "./EditableSection";
import BlockSheet from "./BlockSheet";
import BlockEditPanel from "./BlockEditPanel";
import EditorChat from "./EditorChat";
import PhotoField from "./PhotoField";
import LogoDisplayPanel from "./LogoDisplayPanel";
import ThemePicker from "./ThemePicker";

/** Device modes: «Компʼютер» edits inline; tablet/mobile render the draft in an
 * iframe whose width IS the simulated viewport (frame route), read-only. */
type Device = "desktop" | "tablet" | "mobile";
const DEVICE_WIDTH: Record<Exclude<Device, "desktop">, number> = { tablet: 768, mobile: 375 };

/** lg-breakpoint media query — decides sheet (mobile) vs inspector (desktop). */
function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isDesktop;
}

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

// Render one block. On a TEMPLATE site, mirror PageRenderer: render through the
// template's own section component (honouring the block's `variant`), keyed by
// `section` and gated on the section actually accepting this block type — so the
// editor preview matches the published site. Otherwise (pack/legacy sites) use
// the shared registry with the block's skin. Props were validated on save.
function BlockView({ block, template }: { block: StoredBlock; template?: SiteTemplate }) {
  if (template) {
    const def = template.sections[block.section ?? block.type];
    const matched = def?.block === block.type ? def : undefined;
    const Section =
      (block.variant ? matched?.variants?.[block.variant] : undefined) ?? matched?.component;
    if (Section) {
      const S = Section as ComponentType<{ data: unknown }>;
      return <S data={block.props} />;
    }
  }
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
  const [packId, setPackId] = useState<string | undefined>(initial.packId);
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
  const [logoOpen, setLogoOpen] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | undefined>(undefined);
  const [logoBusy, setLogoBusy] = useState(false);
  const [device, setDevice] = useState<Device>("desktop");
  // Bumped after every persisted draft change → remounts the preview iframe so
  // tablet/mobile modes always show the current draft.
  const [frameVersion, setFrameVersion] = useState(0);
  const isDesktop = useIsDesktop();
  // Agent chat (P3): docked left panel on desktop (ON by default — owner
  // request), full-screen overlay on mobile (opened via the toolbar button).
  const [chatOpen, setChatOpen] = useState(false);
  const chatAutoOpened = useRef(false);
  useEffect(() => {
    if (isDesktop && !chatAutoOpened.current) {
      chatAutoOpened.current = true;
      setChatOpen(true);
    }
  }, [isDesktop]);
  const [agentUndo, setAgentUndo] = useState<StoredBlock[] | null>(null);
  const [undoBusy, setUndoBusy] = useState(false);

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
    setFrameVersion((v) => v + 1);
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
      setFrameVersion((v) => v + 1);
      notify({ text: "Оформлення змінено" });
    } else {
      notify({ text: `Не вдалося змінити оформлення: ${res.error ?? "помилка"}` });
    }
  };

  // Switch a whole design pack — theme AND every section's skin at once. Like
  // pickTheme this persists the draft server-side, so we mirror its after-effects
  // (dirty flag, close the sheet, toast) and also swap the previewed blocks.
  const pickPack = async (id: string) => {
    setBusyLabel("theme");
    const res = await switchDesignPack(host, id);
    setBusyLabel(null);
    if (res.ok && res.theme && res.blocks) {
      setTheme(res.theme);
      setBlocks(res.blocks);
      setPackId(id);
      setDirty(true);
      setThemeOpen(false);
      setFrameVersion((v) => v + 1);
      notify({ text: "Дизайн змінено" });
    } else {
      notify({ text: `Не вдалося змінити дизайн: ${res.error ?? "помилка"}` });
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
      setFrameVersion((v) => v + 1);
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

  // «Лого» — the logo lives on the unversioned tenant.brand, so a change is live
  // immediately (setLogoAction purges the cache). Load on open; save on
  // upload/clear. Uploads scope by host, like the block editor's photo fields.
  const openLogo = async () => {
    setLogoOpen(true);
    setLogoBusy(true);
    try {
      const res = await getLogoAction(host);
      if (res.ok) setLogoUrl(res.logoUrl);
    } catch {
      // Non-fatal: the sheet opens with an empty slot the owner can still fill.
    } finally {
      setLogoBusy(false);
    }
  };

  const saveLogo = async (url: string | null) => {
    setLogoBusy(true);
    try {
      const res = await setLogoAction(host, url);
      if (res.ok) {
        setLogoUrl(res.logoUrl);
        notify({ text: url ? "Лого збережено — вже на сайті" : "Лого прибрано" });
      } else {
        notify({ text: `Не вдалося зберегти лого: ${res.error ?? "помилка"}` });
      }
    } catch {
      notify({ text: "Не вдалося звʼязатися з сервером. Спробуйте ще раз." });
    } finally {
      setLogoBusy(false);
    }
  };

  // The agent mutated the draft server-side → adopt its state locally and give
  // the owner one-click undo to the pre-turn snapshot.
  const applyAgentResult = (nextBlocks: StoredBlock[], nextTheme: Theme) => {
    setBlocks(nextBlocks);
    setTheme(nextTheme);
    setDirty(true);
    setFrameVersion((v) => v + 1);
    setSelectedIndex(null);
  };

  const undoAgent = async () => {
    if (!agentUndo || undoBusy) return;
    setUndoBusy(true);
    const snapshot = agentUndo;
    const ok = await persist(snapshot, "Зміни помічника скасовано");
    setUndoBusy(false);
    if (ok) {
      setBlocks(snapshot);
      setAgentUndo(null);
    }
  };

  const statusLabel = STATUS_LABELS[initial.status] ?? STATUS_LABELS.draft;
  const regenerating = busyLabel === "regenerate";
  const themeBusy = busyLabel === "theme";
  const selected = selectedIndex != null ? blocks[selectedIndex] : null;

  const chatPanel = chatOpen ? (
    <EditorChat
      host={host}
      getSnapshot={() => blocks}
      onApply={applyAgentResult}
      onUndoAvailable={(snapshot) => setAgentUndo(snapshot)}
      onClose={() => setChatOpen(false)}
    />
  ) : null;

  const previewStyle = {
    ...themeToCssVars(theme),
    backgroundColor: "var(--color-background)",
    color: "var(--color-foreground)",
    fontFamily: "var(--font-body)",
  };

  // Template sites render inside the template's OWN wrapper (its palette/fonts +
  // Nav/Footer), each section through its template component — matching the
  // published site. Pack/legacy sites keep the theme-vars framed preview.
  const template = getTemplate(initial.templateId);
  const TemplateWrapper = template?.wrapper;
  const sectionEls = blocks.map((block, index) => (
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
      <BlockView block={block} template={template} />
    </EditableSection>
  ));

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
              variant={chatOpen ? "primary" : "secondary"}
              size="sm"
              className="shrink-0"
              onClick={() => setChatOpen((v) => !v)}
            >
              <Sparkles size={15} /> Помічник
            </Button>
            {agentUndo && (
              <Button
                variant="secondary"
                size="sm"
                disabled={undoBusy}
                className="shrink-0"
                onClick={() => void undoAgent()}
              >
                <Undo2 size={15} />
                <span className="hidden xl:inline">{undoBusy ? "Повертаємо…" : "Скасувати зміни ШІ"}</span>
              </Button>
            )}
            {/* Device preview toggle — desktop edits inline; tablet/mobile show
                the draft in a real-viewport iframe (read-only). */}
            <div className="hidden shrink-0 items-center gap-0.5 rounded-[12px] bg-sunken p-1 md:flex">
              {(
                [
                  { id: "desktop", icon: Monitor, title: "Компʼютер — редагування" },
                  { id: "tablet", icon: Tablet, title: "Планшет — перегляд" },
                  { id: "mobile", icon: Smartphone, title: "Телефон — перегляд" },
                ] as const
              ).map(({ id, icon: Icon, title }) => (
                <button
                  key={id}
                  type="button"
                  title={title}
                  aria-pressed={device === id}
                  onClick={() => setDevice(id)}
                  className={`flex h-8 w-9 items-center justify-center rounded-[9px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                    device === id ? "bg-surface text-brand shadow-card" : "text-ink-muted hover:text-ink"
                  }`}
                >
                  <Icon size={16} />
                </button>
              ))}
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="shrink-0"
              onClick={() => setThemeOpen(true)}
            >
              <Palette size={15} /> Оформлення
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="shrink-0"
              onClick={() => void openLogo()}
            >
              <ImageIcon size={15} /> Лого
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={regenerating}
              className="shrink-0"
              onClick={() => setRegenConfirmOpen(true)}
            >
              <RefreshCw size={15} className={regenerating ? "animate-spin" : undefined} />
              <span className="hidden sm:inline">
                {regenerating ? "Збираємо…" : "Перегенерувати"}
              </span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={publishing}
              className="w-full sm:w-auto"
              onClick={publish}
            >
              {publishing ? "Публікуємо…" : "Опублікувати"}
            </Button>
          </div>
        </div>
      </header>

      {/* Draft preview + desktop inspector. The preview column: «Компʼютер» =
          inline editable render; tablet/mobile = real-viewport iframe of the
          frame route (read-only responsiveness check). */}
      <main className="mx-auto flex max-w-[1600px] items-start gap-5 px-2 py-4 sm:px-4 sm:py-6">
        {/* Agent chat — docked left on desktop, full-screen overlay on mobile. */}
        {chatOpen && isDesktop && (
          <aside className="sticky top-24 hidden w-[340px] shrink-0 lg:block">
            <Card className="flex h-[calc(100vh-8rem)] flex-col overflow-hidden">{chatPanel}</Card>
          </aside>
        )}
        {chatOpen && !isDesktop && (
          <div className="fixed inset-0 z-40 flex flex-col bg-surface">{chatPanel}</div>
        )}

        <div className="min-w-0 flex-1">
          {device === "desktop" ? (
            <div
              className="overflow-hidden rounded-[24px] border border-line bg-surface shadow-card"
              // A template preview's Nav (and theme toggle) use `position: fixed`;
              // a transform here makes this the containing block for them so they
              // stay INSIDE the framed preview instead of floating over the editor
              // chrome. No effect on pack/legacy previews.
              style={TemplateWrapper ? { transform: "translateZ(0)" } : undefined}
            >
              {blocks.length === 0 ? (
                <div className="px-6 py-24 text-center text-[15px] font-medium text-ink-faint">
                  Тут поки порожньо. Натисніть «Перегенерувати», щоб зібрати сайт із ваших даних.
                </div>
              ) : TemplateWrapper ? (
                <TemplateWrapper>{sectionEls}</TemplateWrapper>
              ) : (
                <div style={previewStyle}>{sectionEls}</div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <iframe
                key={`${device}-${frameVersion}`}
                src={`/edit/${encodeURIComponent(host)}/frame`}
                title="Перегляд сайту"
                style={{ width: DEVICE_WIDTH[device], maxWidth: "100%" }}
                className="h-[calc(100vh-220px)] min-h-[480px] rounded-[24px] border border-line bg-white shadow-card"
              />
              <p className="text-[13px] font-semibold text-ink-faint">
                Перегляд {device === "tablet" ? "планшета" : "телефона"} — редагування в режимі
                «Компʼютер».
              </p>
            </div>
          )}
          {device === "desktop" && (
            <p className="mx-auto mt-4 max-w-md text-center text-[14px] font-semibold text-ink-faint">
              Натисніть на будь-яку секцію, щоб змінити текст або фото. Зміни зберігаються в
              чернетку — натисніть «Опублікувати», щоб вони зʼявились на сайті.
            </p>
          )}

          <Card className="mt-4 flex flex-col items-start gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[15px] font-semibold text-ink-muted">
              Потрібно щось особливе — інша структура, дизайн, додаткові сторінки?
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="w-full shrink-0 sm:w-auto"
              onClick={() => setCustomOpen(true)}
            >
              Хочу кастомні зміни
            </Button>
          </Card>
        </div>

      </main>

      {/* Desktop block editor — a right DRAWER over the preview (owner request):
          slides in on section click, no permanent right column. No backdrop, so
          clicking another section switches the drawer to it. */}
      {isDesktop && selected && selectedIndex != null && (
        <div className="fixed inset-y-0 right-0 z-40 flex w-[400px] flex-col border-l border-line bg-surface shadow-[-16px_0_48px_rgba(23,36,47,.2)]">
          <div className="flex items-center justify-between border-b border-sunken px-5 py-3.5">
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-ink-faint">
                Редагування секції
              </div>
              <div className="font-brand text-[17px] font-medium text-ink">
                {blockLibrary[selected.type]?.label ?? selected.type}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedIndex(null)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-[20px] text-ink-faint transition-colors hover:bg-sunken hover:text-ink"
              aria-label="Закрити"
            >
              ×
            </button>
          </div>
          <BlockEditPanel
            key={selectedIndex}
            block={selected}
            host={host}
            saving={saving}
            onSave={(props) => void handleSaveBlock(selectedIndex, props)}
            onSkinChange={(skin) => handleSkinChange(selectedIndex, skin)}
            onClose={() => setSelectedIndex(null)}
          />
        </div>
      )}

      {!isDesktop && selected && selectedIndex != null && (
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
          currentPackId={packId}
          pending={themeBusy}
          onPick={(id) => void pickTheme(id)}
          onPickPack={(id) => void pickPack(id)}
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

      <Sheet
        open={logoOpen}
        onClose={() => {
          if (!logoBusy) setLogoOpen(false);
        }}
        title="Лого сайту"
      >
        <p className="mb-4 text-[15px] leading-relaxed text-ink-muted">
          Лого показується у шапці сайту поряд із назвою. Зміни застосовуються одразу.
        </p>
        <PhotoField
          value={logoUrl}
          host={host}
          kind="logo"
          onChange={(url) => void saveLogo(url)}
          onClear={() => void saveLogo(null)}
        />
        <LogoDisplayPanel host={host} logoUrl={logoUrl} />
        {logoUrl && (
          <Button
            variant="danger"
            size="md"
            className="mt-4"
            disabled={logoBusy}
            onClick={() => void saveLogo(null)}
          >
            Прибрати лого
          </Button>
        )}
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
