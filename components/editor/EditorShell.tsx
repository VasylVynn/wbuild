"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import Link from "next/link";
import { ArrowLeft, ImageIcon, RefreshCw, Monitor, Tablet, Smartphone, Sparkles, Undo2 } from "lucide-react";
import {
  saveDraftBlocks,
  regenerateSite,
  publishSite,
  customRequestAction,
  type EditorData,
} from "@/app/app/(protected)/edit/actions";
import { publicSiteUrl, rootSiteUrl } from "@/lib/config";
import { getLogoAction, setLogoAction } from "@/app/app/(protected)/edit/logo-actions";
import { blockRegistry } from "@/lib/blocks/registry";
import { blockLibrary } from "@/lib/blocks/library";
import { getTemplate, type SiteTemplate, type TemplateBrand } from "@/lib/templates/registry";
import type { StoredBlock } from "@/lib/blocks/schema";
import { Button, Card, Chip, ConfirmDialog, Sheet, Textarea, Toast } from "@/components/ui";
import { usePaywallCheckout, PRICE_UAH } from "@/components/pay/usePaywallCheckout";
import { phCapture } from "@/components/analytics/PostHogProvider";
import EditableSection from "./EditableSection";
import BlockSheet from "./BlockSheet";
import BlockEditPanel from "./BlockEditPanel";
import EditorChat from "./EditorChat";
import PhotoField from "./PhotoField";

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
 * regenerates from facts, and publishes. The chrome is the calm neutral
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

// Render one block, mirroring PageRenderer: through the wireframe's own section
// component (honouring the block's `variant`), keyed by `section` and gated on
// the section actually accepting this block type — so the editor preview matches
// the published site. A block the wireframe has no section for falls back to the
// shared registry component. Props were validated on save.
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
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [regenConfirmOpen, setRegenConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  // Paywall modal (spec §3): publishing an unpaid site opens the offer instead
  // of failing with a toast the owner can do nothing about. The price comes
  // back with that refusal — PRICE_UAH is only the pre-answer fallback.
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [price, setPrice] = useState(PRICE_UAH);
  const [busyLabel, setBusyLabel] = useState<string | null>(null); // regenerate
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



  // Rebuild the site from the owner's facts. Gated behind a confirm dialog; the
  // current draft is kept server-side, so nothing is lost (§5.5).
  const runRegenerate = async () => {
    setBusyLabel("regenerate");
    const res = await regenerateSite(host);
    setBusyLabel(null);
    setRegenConfirmOpen(false);
    if (res.ok && res.blocks) {
      setBlocks(res.blocks);
      setDirty(true);
      setFrameVersion((v) => v + 1);
      notify({ text: "Сайт зібрано наново" });
    } else {
      notify({ text: `Не вдалося перегенерувати: ${res.error ?? "помилка"}` });
    }
  };

  const publish = async (opts?: { paywallRetry?: boolean }): Promise<boolean> => {
    setPublishing(true);
    const res = await publishSite(host, opts);
    setPublishing(false);
    if (res.ok) {
      const url = publicSiteUrl(host);
      setDirty(false);
      notify({ text: "Опубліковано! Зміни вже на сайті", href: url });
      return true;
    }
    if (res.paymentRequired) {
      if (res.price) setPrice(res.price);
      setPaywallOpen(true);
      return false;
    }
    notify({ text: `Не вдалося опублікувати: ${res.error ?? "помилка"}` });
    return false;
  };

  // Same checkout + polling as the onboarding chat — one implementation, two
  // surfaces. A confirmed payment simply retries the publish — flagged as a
  // retry so the funnel counts one «publish_clicked» per owner, not two.
  const paywall = usePaywallCheckout({
    host,
    surface: "editor",
    onPaid: async () => {
      if (await publish({ paywallRetry: true })) setPaywallOpen(false);
    },
  });

  // «Saw the offer», once per editor session: the dialog is closed and reopened
  // freely after a decline, and that is one owner deciding once, not two. The
  // checkout events it leads to live in usePaywallCheckout, shared with the chat.
  const paywallShown = useRef(false);
  useEffect(() => {
    if (!paywallOpen || paywallShown.current) return;
    paywallShown.current = true;
    phCapture("ui_paywall_shown", { surface: "editor", host });
  }, [paywallOpen, host]);

  const closePaywall = () => {
    if (paywall.status === "awaiting" || paywall.status === "creating") return;
    paywall.reset();
    setPaywallOpen(false);
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
  const applyAgentResult = (nextBlocks: StoredBlock[]) => {
    setBlocks(nextBlocks);
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

  // The preview renders inside the wireframe's OWN wrapper (Nav/Footer + the
  // generated stylesheet), each section through its wireframe component —
  // matching the published site.
  const template = getTemplate(initial.templateId);
  const TemplateWrapper = template?.wrapper;
  // Feed the template chrome (Nav/Footer) the REAL business identity — same rule
  // as the published site (app/s/[host]) — so the editor preview shows the real
  // brand, nav and contacts instead of the template's demo defaults. Recomputed
  // from the LIVE blocks so nav/contacts track edits.
  const brand: TemplateBrand | undefined = (() => {
    if (!template) return undefined;
    const name = (initial.businessName ?? "").trim();
    const words = name.split(/\s+/).filter(Boolean);
    const NAV_SKIP = new Set(["hero", "stats", "cta", "lead_form", "contacts"]);
    const seen = new Set<string>();
    const navLinks: { href: string; label: string }[] = [];
    for (const b of blocks) {
      const s = b.section;
      if (!s || b.hidden || NAV_SKIP.has(s) || seen.has(s)) continue;
      const label = template.sections[s]?.label;
      if (!label) continue;
      seen.add(s);
      navLinks.push({ href: `#${s}`, label });
    }
    const contact = blocks.find((b) => b.type === "contacts")?.props as
      | { phone?: string; address?: string; hours?: string; email?: string; telegram?: string; viber?: string }
      | undefined;
    return {
      brandName: words.length > 1 ? words.slice(0, -1).join(" ") + " " : name,
      brandAccent: words.length > 1 ? words[words.length - 1] : "",
      navLinks,
      ctaHref: "#lead_form",
      contact,
    };
  })();
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
      <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/sites"
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-canvas px-3 py-1.5 text-[14px] font-semibold text-ink-muted transition-colors hover:bg-sunken hover:text-ink"
            >
              <ArrowLeft size={15} aria-hidden />
              <span className="hidden sm:inline">Сайти</span>
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate font-brand text-[17px] font-medium tracking-tight text-ink sm:text-[19px]">
                  {initial.businessName}
                </span>
                <Chip tone={statusTone(initial.status)} className="shrink-0">
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
                  {statusLabel}
                </Chip>
              </div>
              <div className="flex min-w-0 items-center gap-2 text-[13px] font-semibold text-ink-faint">
                <span className="truncate">{host}</span>
                {dirty && (
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-honey-soft px-2 py-0.5 text-[12px] font-bold text-honey-text">
                    <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-honey" />
                    <span className="hidden sm:inline">є неопубліковані зміни</span>
                    <span className="sm:hidden">не опубліковано</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
            {/* Toggle, not a CTA — «Опублікувати» stays the only filled button in
                the bar; an open panel is marked with an ink ring. */}
            <Button
              variant="secondary"
              size="sm"
              aria-pressed={chatOpen}
              className={`shrink-0 ${chatOpen ? "ring-2 ring-brand" : ""}`}
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
            <div className="hidden shrink-0 items-center gap-0.5 rounded-full border border-line bg-canvas p-0.5 md:flex">
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
                  className={`flex h-8 w-9 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-honey-deep ${
                    device === id ? "bg-brand text-white" : "text-ink-muted hover:text-ink"
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
            {/* Publish is the one filled action in the bar — the owner's decision,
                never the agent's (§ invariant 6). Unpublished changes ring it honey. */}
            <Button
              variant="primary"
              size="md"
              disabled={publishing}
              className={`w-full shrink-0 sm:w-auto ${
                dirty && !publishing ? "ring-2 ring-honey ring-offset-2 ring-offset-surface" : ""
              }`}
              onClick={() => void publish()}
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
            /* Browser-chrome frame: the draft always reads as «your site», never
               as part of the editor chrome around it. */
            <div className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
              <div className="flex items-center gap-3 border-b border-line bg-canvas px-4 py-2.5">
                <span aria-hidden className="flex shrink-0 gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
                  <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
                  <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
                </span>
                <span className="mx-auto max-w-[70%] truncate rounded-full bg-sunken px-3 py-1 text-[12px] font-semibold text-ink-faint">
                  {host}
                </span>
                <span aria-hidden className="w-[42px] shrink-0" />
              </div>
              <div
                // The preview's Nav uses `position: fixed`; a transform here makes
                // this the containing block for it so it stays INSIDE the framed
                // preview instead of floating over the editor chrome.
                style={TemplateWrapper ? { transform: "translateZ(0)" } : undefined}
              >
                {blocks.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 px-6 py-24 text-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-honey-soft text-honey-text">
                      <Sparkles size={20} />
                    </span>
                    <p className="max-w-sm text-[15px] font-medium text-ink-muted">
                      Тут поки порожньо. Натисніть «Перегенерувати», щоб зібрати сайт із ваших
                      даних.
                    </p>
                  </div>
                ) : TemplateWrapper ? (
                  <TemplateWrapper brand={brand}>{sectionEls}</TemplateWrapper>
                ) : (
                  <>{sectionEls}</>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              {/* Device bezel — the iframe keeps its exact simulated width; the
                  frame is drawn around it. */}
              <div
                className={`max-w-full overflow-hidden bg-ink shadow-card ${
                  device === "mobile"
                    ? "rounded-[2.75rem] border-[10px] border-ink"
                    : "rounded-[2rem] border-[12px] border-ink"
                }`}
              >
                <iframe
                  key={`${device}-${frameVersion}`}
                  src={`/edit/${encodeURIComponent(host)}/frame`}
                  title="Перегляд сайту"
                  style={{ width: DEVICE_WIDTH[device], maxWidth: "100%" }}
                  className={`block h-[calc(100vh-220px)] min-h-[480px] bg-white ${
                    device === "mobile" ? "rounded-[2rem]" : "rounded-[1.25rem]"
                  }`}
                />
              </div>
              <p className="text-[13px] font-semibold text-ink-faint">
                Перегляд {device === "tablet" ? "планшета" : "телефона"} — редагування в режимі
                «Компʼютер».
              </p>
            </div>
          )}
          {device === "desktop" && (
            <p className="mx-auto mt-4 max-w-md text-center text-[14px] font-medium leading-relaxed text-ink-muted">
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
        <div className="fixed inset-y-0 right-0 z-40 flex w-[400px] flex-col rounded-l-sheet border-l border-line bg-surface shadow-[-16px_0_48px_rgba(51,41,28,.14)]">
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-honey-text">
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
          onClose={() => setSelectedIndex(null)}
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

      {/* Paywall (spec §3): same offer and same checkout as the onboarding
          chat, in the editor's dialog shape. */}
      {paywallOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <button
            aria-label="Закрити"
            className="absolute inset-0 h-full w-full bg-ink/40"
            onClick={closePaywall}
          />
          <div className="relative w-full max-w-sm rounded-[20px] bg-surface p-6 shadow-card">
            <h3 className="text-[19px] font-bold text-ink">Сайт готовий до публікації</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">
              {price} грн одноразово — сайт і власний домен на 1 рік.
            </p>

            {paywall.status === "paid" ? (
              /* Paid, but the publish that followed it failed. The site is
                 bought — the only way forward is another publish attempt, never
                 a second checkout. */
              <div className="mt-5 flex flex-col gap-2">
                <Button
                  size="lg"
                  className="w-full"
                  disabled={publishing || paywall.retrying}
                  onClick={() => void paywall.retryPublish()}
                >
                  {publishing || paywall.retrying ? "Публікуємо…" : "Спробувати опублікувати ще раз"}
                </Button>
                <span className="text-[14px] leading-snug text-ink-muted">
                  Оплату отримано — повторно платити не потрібно.
                </span>
              </div>
            ) : paywall.status === "awaiting" ? (
              <div className="mt-5 flex flex-col gap-2" role="status">
                <span className="flex items-center gap-2.5 text-[16px] font-bold text-ink">
                  <span
                    className="inline-block h-4 w-4 animate-spin rounded-full border-[2.5px] border-honey border-t-transparent"
                    aria-hidden
                  />
                  Очікуємо оплату…
                </span>
                <span className="text-[14px] leading-snug text-ink-muted">
                  Оплата відкрилась у новій вкладці. Поверніться сюди — щойно платіж пройде, сайт
                  опублікується сам.
                </span>
              </div>
            ) : (
              <Button
                size="lg"
                className="mt-5 w-full"
                disabled={paywall.status === "creating" || publishing}
                onClick={() => void paywall.start()}
              >
                {paywall.status === "creating"
                  ? "Готуємо оплату…"
                  : paywall.status === "failed" || paywall.status === "error"
                    ? "Спробувати ще раз"
                    : `Опублікувати — ${price} грн`}
              </Button>
            )}

            {(paywall.status === "failed" || paywall.status === "error") && paywall.error && (
              <p className="mt-3 rounded-[14px] bg-danger-soft px-4 py-3 text-[14px] font-semibold leading-relaxed text-danger">
                {paywall.status === "failed" ? "Оплата не пройшла. " : ""}
                {paywall.error}
              </p>
            )}

            <div className="mt-4 flex items-center justify-between gap-3">
              {/* The offer lives on the marketing root — the editor host has no
                  /oferta route (middleware rewrites it into /app). */}
              <a
                href={rootSiteUrl("/oferta")}
                target="_blank"
                rel="noreferrer"
                className="text-[13px] text-ink-faint underline underline-offset-2 hover:text-ink-muted"
              >
                Публічна оферта
              </a>
              <Button
                variant="quiet"
                size="sm"
                disabled={paywall.status === "awaiting" || paywall.status === "creating"}
                onClick={closePaywall}
              >
                Пізніше
              </Button>
            </div>
          </div>
        </div>
      )}

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
