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
import { useRouter } from "next/navigation";
import { publicSiteUrl } from "@/lib/config";
import { getLogoAction, setLogoAction } from "@/app/app/(protected)/edit/logo-actions";
import { getTelegramConnectLinkForHost } from "@/app/app/(protected)/(shell)/sites/actions";
import DomainStep from "@/components/onboard/DomainStep";
import { pixelTrack } from "@/lib/analytics/pixel";
import { phCapture } from "@/components/analytics/PostHogProvider";
import { blockRegistry } from "@/lib/blocks/registry";
import { blockLibrary } from "@/lib/blocks/library";
import { getTemplate, type SiteTemplate, type TemplateBrand } from "@/lib/templates/registry";
import { buildTemplateBrand } from "@/lib/templates/brand";
import { TENANT_FONT_CLASSES } from "@/lib/fonts";
import type { StoredBlock } from "@/lib/blocks/schema";
import { Button, Card, Chip, ConfirmDialog, Sheet, Textarea, Toast } from "@/components/ui";
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
  const router = useRouter();
  const [blocks, setBlocks] = useState<StoredBlock[]>(initial.blocks);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [regenConfirmOpen, setRegenConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [busyLabel, setBusyLabel] = useState<string | null>(null); // regenerate
  const [dirty, setDirty] = useState(false); // unpublished draft changes
  // Whether the site is LIVE, in component state: publishing happens inside this
  // component, so a chip driven by `initial.published` would keep saying
  // «Чернетка» until a reload — the owner publishes and the page tells them
  // nothing happened.
  const [published, setPublished] = useState(initial.published);
  // The DESIGN lives in state, not in the server prop it arrived on. Rendering
  // straight from `initial` meant every design change — the agent's style tool,
  // a regeneration — was invisible until the owner reloaded the page: the
  // pipeline had written the new sheet, and the screen was still showing the
  // one React was handed at mount.
  const [wireCss, setWireCss] = useState(initial.wireCss);
  const [designSpec, setDesignSpec] = useState(initial.designSpec);
  // THE post-publish moment (owner decision 2026-08-11). The onboarding flow no
  // longer has a success screen: a finished draft lands in this editor, and the
  // one human publish press opens this sheet — live URL, the owner's own domain,
  // and Telegram, in the order they matter. Skipping the domain is a first-class
  // exit; the site is already live and free on its subdomain.
  const [liveSheet, setLiveSheet] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const publishTracked = useRef(false);
  // ViewContent = «побачив свій сайт», the moment the funnel is really working.
  // It used to fire when the onboarding preview screen mounted; that screen is
  // gone, and THIS is where a freshly generated site is first seen (?fresh=1 is
  // stamped by the hand-off in OnboardChat).
  const firstSightSent = useRef(false);
  useEffect(() => {
    if (firstSightSent.current) return;
    if (!new URLSearchParams(window.location.search).has("fresh")) return;
    firstSightSent.current = true;
    pixelTrack("ViewContent");
    phCapture("ui_preview_shown", { surface: "editor", host });
  }, [host]);
  // The t.me deep link for THIS site. Held as a memoised PROMISE, not a boolean
  // "already asked": the token mint must not be raced (one call per site), and a
  // flag set before the answer arrives would leave the row stuck if React tore
  // the effect down and re-ran it. Resolved ahead of the press because a link
  // fetched inside the handler opens a window no gesture is attributed to.
  const [tgLink, setTgLink] = useState<string | null>(null);
  const tgReq = useRef<Promise<{ ok: true; link: string } | { ok: false; error: string }> | null>(
    null,
  );
  useEffect(() => {
    if (!published || initial.telegramConnected) return;
    if (!tgReq.current) tgReq.current = getTelegramConnectLinkForHost(host);
    let cancelled = false;
    tgReq.current
      .then((res) => {
        if (!cancelled) setTgLink(res.ok ? res.link : "");
      })
      .catch(() => {
        if (!cancelled) setTgLink("");
      });
    return () => {
      cancelled = true;
    };
  }, [published, initial.telegramConnected, host]);
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
      // The whole point of «Перегенерувати» is a different LOOK — apply it.
      if (res.wireCss) setWireCss(res.wireCss);
      if (res.designSpec) setDesignSpec(res.designSpec);
      setDirty(true);
      setFrameVersion((v) => v + 1);
      // The DESIGN lives in props captured at page load (initial.wireCss /
      // initial.designSpec), and regenerateSite returns blocks only — so
      // without this the owner got new content poured into the OLD stylesheet
      // and reported «стилі, кнопки лишились ті самі… а що воно тоді
      // перегенерувало? Контент?». Literally: content was all the client
      // updated. setBlocks above keeps the change instant; the refresh brings
      // the new sheet a moment later.
      router.refresh();
      notify({ text: "Сайт зібрано наново" });
    } else {
      notify({ text: `Не вдалося перегенерувати: ${res.error ?? "помилка"}` });
    }
  };

  // Free since 2026-08-06: publishing costs nothing, so this is the whole path.
  // The ₴999 buys a custom domain, which is ordered from the onboarding success
  // screen (the editor has no domain UI yet).
  const publish = async (): Promise<boolean> => {
    setPublishing(true);
    const res = await publishSite(host);
    setPublishing(false);
    if (res.ok) {
      const url = publicSiteUrl(host);
      setDirty(false);
      // FIRST publish is the moment; a later re-publish of an edit is not, and
      // must not throw a domain offer in the owner's face every time they fix a
      // typo. `published` still holds the pre-publish value here.
      const firstTime = !published;
      setPublished(true);
      if (firstTime) {
        if (!publishTracked.current) {
          publishTracked.current = true;
          phCapture("ui_publish_success", { surface: "editor", host });
        }
        setLiveSheet(url);
      } else {
        notify({ text: "Опубліковано! Зміни вже на сайті", href: url });
      }
      return true;
    }
    notify({ text: `Не вдалося опублікувати: ${res.error ?? "помилка"}` });
    return false;
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

  // The chip answers ONE question — can a visitor see this? — so it reads the
  // page's own published state, not the tenant row's lifecycle field.
  const statusKey = published ? "published" : "draft";
  const statusLabel = STATUS_LABELS[statusKey] ?? STATUS_LABELS.draft;
  const regenerating = busyLabel === "regenerate";
  const selected = selectedIndex != null ? blocks[selectedIndex] : null;

  const chatPanel = chatOpen ? (
    <EditorChat
      host={host}
      getSnapshot={() => blocks}
      onApply={applyAgentResult}
      onUndoAvailable={(snapshot) => setAgentUndo(snapshot)}
      onStyleChanged={(css) => {
        // Apply it here and now. `router.refresh()` alone was not enough: the
        // preview read the sheet from a prop captured at mount, so the owner
        // watched the agent report success and saw nothing change.
        if (css) setWireCss(css);
        setDirty(true);
        setFrameVersion((v) => v + 1);
        router.refresh();
      }}
      onClose={() => setChatOpen(false)}
    />
  ) : null;

  // The preview renders inside the wireframe's OWN wrapper (Nav/Footer + the
  // generated stylesheet), each section through its wireframe component —
  // matching the published site.
  const template = getTemplate(initial.templateId);
  const TemplateWrapper = template?.wrapper;
  // Desktop editor parity (pipeline v2 §11-V3): the inline preview goes
  // through the SAME brand builder as the frame route and the published site
  // (buildTemplateBrand), so the wrapper injects the draft's wireCss and reads
  // typography/motion from its designSpec — the owner previews the styled
  // site, not a grey wireframe with product fonts. Recomputed from the LIVE
  // blocks so nav/contacts track edits; wireCss/designSpec are the draft's
  // (a regeneration calls router.refresh(), which re-runs the page and hands
  //  this component the new sheet — it does NOT remount by itself).
  const brand: TemplateBrand | undefined = template
    ? buildTemplateBrand(
        initial.businessName,
        blocks,
        template,
        initial.displayLogo,
        wireCss,
        designSpec,
      )
    : undefined;
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
                <Chip tone={statusTone(statusKey)} className="shrink-0">
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

      {/* THE two facts an owner cannot deduce from a screen that renders their
          site beautifully: nobody can see it yet, and nobody will be told when
          a lead arrives. Both are the difference between «I made a site» and
          «the site works», and until now the editor knew each of them and said
          neither — `telegramConnected` was computed and never rendered. */}
      {!published ? (
        <div className="mx-auto mt-3 flex w-full max-w-[1600px] items-center gap-3 rounded-[16px] border border-honey/60 bg-honey-soft px-4 py-3 sm:px-4">
          <span aria-hidden className="text-[18px]">👀</span>
          <div className="min-w-0 flex-1 text-[14px] font-semibold leading-snug text-honey-text">
            Сайт ще не опубліковано — його поки ніхто не бачить. Погортайте, змініть що
            треба, і тисніть «Опублікувати».
          </div>
        </div>
      ) : !initial.telegramConnected ? (
        <div className="mx-auto mt-3 flex w-full max-w-[1600px] items-center gap-3 rounded-[16px] border border-line-strong bg-surface px-4 py-3 sm:px-4">
          <span aria-hidden className="text-[18px]">📩</span>
          <div className="min-w-0 flex-1 text-[14px] font-semibold leading-snug text-ink">
            Заявки з сайту зберігаються, але вам про них ніхто не повідомить —
            підключіть Telegram.
          </div>
          {tgLink ? (
            <a
              href={tgLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-9 shrink-0 items-center justify-center rounded-full bg-tg px-4 text-[14px] font-bold text-white transition-colors hover:bg-tg-dark"
            >
              Відкрити Telegram
            </a>
          ) : tgLink === null ? (
            <span className="flex min-h-9 shrink-0 items-center justify-center rounded-full bg-tg/60 px-4 text-[14px] font-bold text-white">
              Готуємо…
            </span>
          ) : (
            <Link
              href="/sites"
              className="flex min-h-9 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface px-4 text-[14px] font-bold text-ink transition-colors hover:bg-sunken"
            >
              Мої сайти
            </Link>
          )}
        </div>
      ) : null}

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
                // Tenant font parity (v2 §11-V3): the same font-variable classes
                // the frame route and the public layout attach, so the draft's
                // designSpec `--font-*` vars resolve to real families inline too.
                className={TENANT_FONT_CLASSES}
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


      {/* THE post-publish moment. One sheet, three things, ranked: the site is
          live (open it — that is what makes it real), the owner's own name for
          it, and Telegram, without which a lead is stored and nobody is told.
          «Продовжити без власного домену» closes it; the site already works. */}
      <Sheet
        open={liveSheet !== null}
        onClose={() => setLiveSheet(null)}
        title="Ваш сайт опубліковано"
      >
        <p className="text-[15px] leading-relaxed text-ink-muted">
          Він уже працює — безкоштовно — за адресою:
        </p>
        <div className="mt-3 flex flex-col gap-3 rounded-[18px] border border-line bg-canvas p-4">
          <span
            id="live-url"
            className="break-all text-center font-brand text-[17px] font-semibold text-ink"
          >
            {(liveSheet ?? "").replace(/^https?:\/\//, "")}
          </span>
          <div className="flex gap-2.5">
            <a
              href={liveSheet ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-[50px] flex-[1.3] items-center justify-center rounded-[14px] bg-brand text-[16px] font-bold text-white transition-colors hover:bg-brand-hover"
            >
              Відкрити сайт ↗
            </a>
            <button
              onClick={() => {
                // `navigator.clipboard` is undefined outside a secure context —
                // which includes the http://app.lvh.me dev host — so calling
                // .then() on the optional-chained result threw and the button
                // did nothing at all, silently. Copy when we can, and fall back
                // to selecting the address so it can still be copied by hand.
                void (async () => {
                  try {
                    await navigator.clipboard.writeText(liveSheet ?? "");
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  } catch {
                    const el = document.getElementById("live-url");
                    if (el) {
                      const range = document.createRange();
                      range.selectNodeContents(el);
                      const sel = window.getSelection();
                      sel?.removeAllRanges();
                      sel?.addRange(range);
                    }
                  }
                })();
              }}
              className="flex h-[50px] flex-1 items-center justify-center rounded-[14px] border border-line-strong bg-surface text-[16px] font-bold text-ink transition-colors hover:bg-sunken"
            >
              {copied ? "Скопійовано ✓" : "Копіювати"}
            </button>
          </div>
        </div>

        {/* Telegram before the domain: a domain is a nicer name, Telegram is
            whether anyone hears about a lead at all. */}
        {!initial.telegramConnected && (
          <div className="mt-4 flex items-center gap-3 rounded-[18px] border border-line bg-surface px-4 py-3">
            <span aria-hidden className="text-[18px]">📩</span>
            <div className="min-w-0 flex-1 text-[14px] font-semibold leading-snug text-ink">
              Підключіть Telegram, щоб заявки з сайту приходили вам одразу.
            </div>
            {tgLink ? (
              <a
                href={tgLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-9 shrink-0 items-center justify-center rounded-full bg-tg px-4 text-[14px] font-bold text-white transition-colors hover:bg-tg-dark"
              >
                Відкрити Telegram
              </a>
            ) : (
              <span className="flex min-h-9 shrink-0 items-center justify-center rounded-full bg-tg/60 px-4 text-[14px] font-bold text-white">
                Готуємо…
              </span>
            )}
          </div>
        )}

        <div className="mt-4">
          {/* Its own «skip» IS the sheet's exit — two dismissals side by side
              read as a trick question. */}
          <DomainStep host={host} onSkip={() => setLiveSheet(null)} />
        </div>
      </Sheet>

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
