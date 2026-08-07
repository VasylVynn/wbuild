"use client";

import {
  useState,
  useRef,
  useEffect,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CircleAlert,
  Paperclip,
  PartyPopper,
  Pencil,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useSmoothText } from "@/components/useSmoothText";
import type { ChatMsg } from "@/lib/ai/onboard";
import { hasContactChannel } from "@/lib/onboard/contact-channel";
import {
  onboardAction,
  generateDraftAction,
  finalizeAction,
  sessionStateAction,
} from "@/app/app/new/actions";
import {
  analyzePhotoAction,
  type AnalyzePhotoResult,
} from "@/app/app/new/photo-actions";
import {
  startConversation,
  saveTurn,
  loadConversation,
} from "@/app/app/new/persist-actions";
import type { BusinessFacts } from "@/lib/verticals/schema";
import { MAX_PHOTOS, type SiteMedia, type PhotoMeta } from "@/lib/media/media";
import { processImage } from "@/lib/media/client-image";
import { Button, Card, ConfirmDialog } from "@/components/ui";
import SitePreviewPanel from "@/components/onboard/SitePreviewPanel";
import DomainStep from "@/components/onboard/DomainStep";
import { pixelTrack } from "@/lib/analytics/pixel";
import { phCapture } from "@/components/analytics/PostHogProvider";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Phase = "chat" | "gate" | "generating" | "preview" | "done" | "error";

// Generate-first greetings (W0, plan §0): no questionnaire — the agent infers
// what it can and asks at most 1–2 things itself. Genderless, ≤1 emoji (C4/C5).
const GREETING: ChatMsg = {
  role: "assistant",
  content:
    "Вітаю! 👋 Створю сайт для вашого бізнесу прямо в цій розмові. Розкажіть, що у вас за бізнес — для початку досить назви.",
};

// Instagram-first greeting (wave E) — shown only when the Apify scrape is
// configured server-side (igImportEnabled prop), so the promise is never empty.
// A pasted IG link is now a normal message: the agent calls scrape_instagram itself.
const IG_GREETING: ChatMsg = {
  role: "assistant",
  content:
    "Вітаю! 👋 Створю сайт для вашого бізнесу прямо в цій розмові. Надішліть посилання на Instagram-сторінку — і я витягну все звідти. Або просто розкажіть, що у вас за бізнес.",
};

// The questionnaire progress chips are GONE (W0, plan §0.5) — the agent-status
// tool card is the visible-work signal. This tiny label model survives only to
// feed the «✓ Записано: …» diff note (an honest per-turn diff, not a checklist).
// «Контакт» counts ANY channel (C3/C7): phone / telegram / instagram / viber.
const FACT_NOTES: { label: string; has: (f: Partial<BusinessFacts>) => boolean }[] = [
  { label: "Бізнес", has: (f) => Boolean(f.businessName?.trim()) },
  { label: "Місто", has: (f) => Boolean(f.city?.trim()) },
  { label: "Контакт", has: hasContactChannel },
  { label: "Адреса", has: (f) => Boolean(f.address?.trim()) },
  { label: "Години", has: (f) => Boolean(f.hours?.trim()) },
];
function doneLabels(facts: Partial<BusinessFacts>): string[] {
  return FACT_NOTES.filter((n) => n.has(facts)).map((n) => n.label);
}

// Lowercase the first character so a vision `reason` reads naturally after a
// colon («…не ставив: занадто темне фото»).
function lowerFirst(s: string): string {
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

// Photo metadata (kind + alt from the vision layer) is keyed by storage URL.
// Replace an entry with the same url, else append.
function upsertMeta(list: PhotoMeta[] | undefined, entry: PhotoMeta): PhotoMeta[] {
  const existing = list ?? [];
  const i = existing.findIndex((m) => m.url === entry.url);
  return i === -1
    ? [...existing, entry]
    : existing.map((m, idx) => (idx === i ? entry : m));
}

// Keep meta whose url is still live (a photo or the logo), PLUS text_source /
// hidden entries: those legitimately reference non-gallery photos (they feed the
// dossier, refactor §1.3/§2.1). Undefined when nothing remains.
function pruneMeta(media: SiteMedia): PhotoMeta[] | undefined {
  if (!media.photoMeta?.length) return undefined;
  const live = new Set(media.photos);
  if (media.logoUrl) live.add(media.logoUrl);
  const kept = media.photoMeta.filter(
    (m) => live.has(m.url) || m.role === "text_source" || m.role === "hidden",
  );
  return kept.length ? kept : undefined;
}

// One processed batch item: upload/analysis outcome for a single sent file.
type BatchItem =
  | { failed: true }
  | { failed: false; url: string; analysis: AnalyzePhotoResult; warnings: string[] };

// Ukrainian plural for «відгук» (2–4 відгуки, 5+ відгуків; a batch caps at 8).
function reviewsWord(n: number): string {
  return n < 5 ? "відгуки" : "відгуків";
}

/**
 * Human copy for a THROWN server-action call (network layer, not our
 * {ok:false} contract). Distinct causes get distinct advice:
 *  - a dropped connection («failed to fetch»/«load failed») — offline or
 *    flaky mobile network: refreshing is pointless, retrying is the fix;
 *  - «unexpected response» — the server answered, but not with our action
 *    result. In the wild this is EITHER deployment skew (stale tab, action id
 *    404) or a gateway timeout (504, live 2026-08-06) — the client cannot
 *    tell them apart, so the copy promises only what is true for both:
 *    refresh is safe (conv id lives in localStorage) and then try again.
 */
function actionErrorMessage(err: unknown): string {
  const m = err instanceof Error ? err.message : "";
  if (/failed to fetch|load failed|network/i.test(m)) {
    return "Схоже, зник інтернет. Перевірте з'єднання і натисніть кнопку ще раз.";
  }
  if (/server action|unexpected response/i.test(m)) {
    return "З'єднання із сервером перервалося. Оновіть сторінку (Ctrl+R або ⌘R) — розмова збережеться — і спробуйте ще раз.";
  }
  return m || "Невідома помилка";
}

// Client-side id for pending attachments. NOT crypto.randomUUID — that's
// undefined outside secure contexts (http://app.lvh.me dev host).
let nextAttachId = 0;
function attachId(): string {
  nextAttachId += 1;
  return `att-${nextAttachId}`;
}

// Fold a processed batch into ONE media diff + ONE aggregated assistant
// summary (approved design: variant A). Pure — threads its own accumulator
// instead of re-reading React state (state updates are async; per-photo reads
// would lose prior steps of the same batch: the MAX_PHOTOS cap and
// last-logo-wins both depend on the running result).
function routeBatch(
  before: SiteMedia,
  items: BatchItem[],
): { media: SiteMedia; summary: string; reviews: { quote: string; author: string }[] } {
  let m: SiteMedia = { ...before, photos: [...before.photos] };
  const hadLogoBefore = Boolean(before.logoUrl);
  let logoSet = 0;
  let added = 0;
  let failed = 0;
  let overflow = 0;
  let unreadable = 0;
  const rejected: string[] = [];
  const reviews: { quote: string; author: string }[] = [];
  let firstWarning: string | null = null;

  for (const item of items) {
    if (item.failed) {
      failed += 1;
      continue;
    }
    const { url, analysis: result, warnings } = item;

    // Fail-open (G5): no verdict → plain gallery photo, no meta.
    if (!result.ok) {
      if (m.photos.length >= MAX_PHOTOS) overflow += 1;
      else {
        m = { ...m, photos: [...m.photos, url] };
        added += 1;
      }
      continue;
    }
    const a = result.analysis;

    // Unsuitable or off-topic → nothing saved, reason lands in the summary.
    if (a.suitable === false || a.kind === "irrelevant") {
      rejected.push(lowerFirst(a.reason));
      continue;
    }

    if (a.kind === "logo") {
      m = {
        ...m,
        logoUrl: url,
        photoMeta: upsertMeta(m.photoMeta, { url, kind: "logo", ...(a.alt && { alt: a.alt }) }),
      };
      logoSet += 1;
      continue;
    }

    if (a.kind === "review") {
      // OCR'd text is a CANDIDATE — the owner must confirm before it's a fact
      // (invariant №5). The prefilled author is exactly what will be saved.
      if (!a.reviewQuote) unreadable += 1;
      else reviews.push({ quote: a.reviewQuote, author: a.reviewAuthor ?? "Клієнт" });
      continue;
    }

    // work / interior / menu / person → gallery photo with class + honest alt.
    if (m.photos.length >= MAX_PHOTOS) overflow += 1;
    else {
      m = {
        ...m,
        photos: [...m.photos, url],
        photoMeta: upsertMeta(m.photoMeta, { url, kind: a.kind, ...(a.alt && { alt: a.alt }) }),
      };
      added += 1;
      if (!firstWarning && warnings.length) firstWarning = warnings[0];
    }
  }

  const lines: string[] = [];
  if (logoSet > 0) {
    lines.push(
      hadLogoBefore || logoSet > 1
        ? "Бачу лого — поставив його в шапку сайту, попереднє замінив. 👌"
        : "Бачу лого — поставив його в шапку сайту. 👌",
    );
  }
  if (added > 0) {
    lines.push(
      added === 1
        ? `Гарне фото — додав у галерею (${m.photos.length} з ${MAX_PHOTOS}).`
        : `Додав ${added} фото в галерею (${m.photos.length} з ${MAX_PHOTOS}).`,
    );
    if (firstWarning) lines.push(firstWarning);
  }
  if (reviews.length > 0) {
    lines.push(
      reviews.length === 1
        ? "Знайшов відгук на скріншоті — підтвердіть його нижче."
        : `Знайшов ${reviews.length} ${reviewsWord(reviews.length)} на скріншотах — підтвердіть їх нижче, по одному.`,
    );
  }
  if (unreadable > 0) {
    lines.push(
      "Один зі скріншотів схожий на відгук, але текст не вдалося прочитати — можете написати його текстом, я збережу.",
    );
  }
  if (rejected.length === 1) lines.push(`Одне фото я б на сайт не ставив: ${rejected[0]}`);
  else if (rejected.length > 1) lines.push(`Кілька фото я б на сайт не ставив: ${rejected.join(" ")}`);
  if (overflow > 0) {
    lines.push(
      `Ще ${overflow} не додав — у галереї вже максимум (${MAX_PHOTOS} фото). Замінити можна в редакторі.`,
    );
  }
  if (failed > 0) {
    lines.push(
      failed === 1
        ? "Одне фото не вдалося завантажити — спробуйте надіслати його ще раз."
        : `${failed} фото не вдалося завантажити — спробуйте надіслати їх ще раз.`,
    );
  }

  return {
    media: m,
    summary: lines.length ? lines.join("\n") : "Не вдалося обробити фото — спробуйте ще раз.",
    reviews,
  };
}

// Generation-screen pacing (design D fix, wave TPL3): there is no real
// per-step signal — generateDraftAction is one awaited server action — so
// the step list, sub-message and progress bar are driven by a plain client
// clock (`genElapsed`, ticked in an effect below). Paced to keep visibly
// advancing across the real ~3-minute server budget without ever looking
// frozen or claiming 100% before the call actually resolves.
const GEN_STEPS = [
  "Тексти про ваш бізнес",
  "Послуги та ціни",
  "Оформлення і кольори",
  "Готуємо фото",
  "Збираємо блоки сайту",
  "Форма замовлення",
];
// Seconds elapsed before the step at the same index becomes "active"; the
// last step just stays active for however much longer generation takes —
// there is no signal to mark it "done" early.
const GEN_STEP_SECONDS = [0, 20, 45, 75, 110, 145];
// Rotates under the heading every 40s so a long wait still reads as
// ongoing work, not a stall.
const GEN_MESSAGES = [
  // «до 5 хвилин» = the actual server budget (maxDuration 300 on /new) — a
  // promise shorter than the timeout reads as a hang exactly when generation
  // is slowest and the user is most nervous.
  "Зазвичай це до 3 хвилин, максимум 5 — нікуди не йдіть, ми вже працюємо.",
  "Пишемо тексти й підбираємо кольори під ваш бізнес.",
  "Ще трохи — готуємо фото та збираємо сторінку.",
  "Майже готово — фінальні перевірки перед показом.",
];

// Shared pacing math for BOTH generation renders (full-screen phase and the
// inline chat card, W0): step list index, rotating sub-message, bar width.
function genProgress(elapsed: number): { stepIndex: number; msgIndex: number; barPct: number } {
  const stepIndex = GEN_STEP_SECONDS.reduce((acc, at, i) => (elapsed >= at ? i : acc), 0);
  const msgIndex = Math.min(GEN_MESSAGES.length - 1, Math.floor(elapsed / 40));
  const barPct = 15 + (stepIndex / (GEN_STEPS.length - 1)) * 75; // 15% → 90%, never 100%
  return { stepIndex, msgIndex, barPct };
}

// Design animations (design/D). Kept in-file so this component owns everything;
// prefixed `ob-` to avoid colliding with any global keyframes.
const KEYFRAMES = `
@keyframes ob-typing { 0%,60%,100% { transform: translateY(0); opacity: .5 } 30% { transform: translateY(-4px); opacity: 1 } }
@keyframes ob-pulse { 0%,100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(233,162,59,.28) } 50% { transform: scale(1.06); box-shadow: 0 0 0 12px rgba(233,162,59,0) } }
@keyframes ob-shimmer { 0% { transform: translateX(-120%) } 100% { transform: translateX(220%) } }
@keyframes ob-confetti { 0% { transform: translateY(-24px) rotate(0deg); opacity: 1 } 100% { transform: translateY(240px) rotate(260deg); opacity: 0 } }
`;

const SendArrow = ({ className = "" }: { className?: string }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
    <path
      d="M4 12h14M13 6l6 6-6 6"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const TelegramMark = ({ size = 34 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <circle cx="12" cy="12" r="12" fill="#229ED9" />
    <path
      d="M5.5 11.7l11.3-4.4c.5-.2 1 .1.8.9l-1.9 9c-.1.6-.5.8-1 .5l-2.9-2.2-1.4 1.4c-.2.2-.3.3-.6.3l.2-3 5.4-4.9c.2-.2 0-.3-.3-.1l-6.7 4.2-2.9-.9c-.6-.2-.6-.6 0-.8z"
      fill="#FFFFFF"
    />
  </svg>
);

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function OnboardChat({ igImportEnabled = false }: { igImportEnabled?: boolean }) {
  // --- Chat phase state ---
  const [messages, setMessages] = useState<ChatMsg[]>([igImportEnabled ? IG_GREETING : GREETING]);
  const [facts, setFacts] = useState<Partial<BusinessFacts>>({});
  const [ready, setReady] = useState(false);
  // A6: the user explicitly confirmed the chat summary — unlocks the create CTA.
  const [confirmed, setConfirmed] = useState(false);
  const [verticalId, setVerticalId] = useState<string | undefined>(undefined);
  // Chat-picked site design (wave B5) — { id, label } once the agent proposes one.
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [quickReplies, setQuickReplies] = useState<string[]>(
    igImportEnabled ? ["У мене є Instagram"] : [],
  );
  // «✓ Записав: …» під останньою відповіддю — реальний diff прогресу за хід.
  const [savedNote, setSavedNote] = useState<string | null>(null);

  // --- Shared loading flag (blocks all inputs while a request is in flight) ---
  const [loading, setLoading] = useState(false);

  // --- Phase ---
  const [phase, setPhase] = useState<Phase>("chat");
  // Generation clock (seconds since generation started) — paces the step
  // list / progress bar / sub-message; see the effect below. Shared by the
  // full-screen "generating" phase and the inline chat card.
  const [genElapsed, setGenElapsed] = useState(0);
  // W0 (plan C2/C6): generation triggered by the agent's start_generation
  // signal runs INLINE — phase stays "chat" and a compact progress card sits
  // in the message column instead of the full-screen takeover.
  const [inlineGen, setInlineGen] = useState(false);
  // Set when the stream delivers {t:"generate"} (or final carries
  // generate:true). An EFFECT consumes it: by then React has flushed the
  // facts/media applyResult just set, so runGenerate reads fresh state — a
  // direct call from send()'s closure would generate from the pre-turn facts.
  const [autoGenerate, setAutoGenerate] = useState(false);

  // --- Media (logo + photos) — optional step before generation ---
  const [media, setMedia] = useState<SiteMedia>({ photos: [] });

  // --- Chat photo attachments (wave G, attach-then-send) ---
  // Files attached to the composer but not yet sent — local only (object
  // URLs); nothing hits the server until the owner presses send.
  const [pending, setPending] = useState<{ id: string; file: File; thumbUrl: string }[]>([]);
  // Transient progress card at the end of the message list while a sent batch
  // uploads/analyzes — NOT part of `messages`, so it never persists.
  const [batchCard, setBatchCard] = useState<{ thumbs: string[]; done: number; total: number } | null>(null);
  // Inline, transient error/hint under the chat input.
  const [uploadError, setUploadError] = useState<string | null>(null);
  // Reviews OCR'd from screenshots, queued for the owner's explicit
  // confirmation (one card at a time) before becoming testimonial facts
  // (invariant №5 — no invented facts).
  const [pendingReviews, setPendingReviews] = useState<{ quote: string; author: string }[]>([]);

  // Inline tool-status chips (04 §2): the agent's tool lifecycle, streamed as
  // {t:"tool"} events — the owner watches the agent work, not a blank spinner.
  const [activeTools, setActiveTools] = useState<string[]>([]);

  // --- Reset-conversation confirm dialog ---
  const [resetOpen, setResetOpen] = useState(false);

  // --- Draft preview (04 §2): a generated draft awaiting human publish ---
  const [draft, setDraft] = useState<{ host: string; previewUrl: string; editUrl: string } | null>(
    null,
  );

  // --- Done / error state ---
  const [siteUrl, setSiteUrl] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [copied, setCopied] = useState(false);

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Hidden file input behind the paperclip button (chat photo upload, wave G).
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Holds the persisted conversation id after first user send; null = not yet created
  const convIdRef = useRef<string | null>(null);

  // Revoke still-attached (unsent) thumbnail blob URLs on unmount — they
  // otherwise live for the whole tab. Ref keeps the cleanup closure current.
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  useEffect(
    () => () => {
      for (const p of pendingRef.current) URL.revokeObjectURL(p.thumbUrl);
    },
    [],
  );

  // Auto-scroll the chat COLUMN only (scrollIntoView would also scroll the
  // page/preview ancestors). Own sends always jump; otherwise don't yank the
  // owner back down if they scrolled up to read.
  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    const last = messages[messages.length - 1];
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 300;
    if (nearBottom || last?.role === "user") el.scrollTop = el.scrollHeight;
  }, [messages, typing]);

  // Streaming grows the last bubble every frame — keep the column pinned to
  // the bottom while the turn runs, releasing when the owner scrolls up.
  useEffect(() => {
    if (!loading) return;
    const el = chatScrollRef.current;
    if (!el) return;
    let raf = 0;
    const tick = () => {
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 120) {
        el.scrollTop = el.scrollHeight;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [loading]);

  // On mount: resume a previously persisted conversation from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("vitryna_conv_id");
    if (!stored) return;

    loadConversation(stored).then((data) => {
      // Only restore when there is actual back-and-forth (>1 means user spoke)
      if (!data || data.messages.length <= 1) return;
      convIdRef.current = stored;
      setMessages(data.messages);
      setFacts(data.facts as Partial<BusinessFacts>);
      setVerticalId(data.verticalId);
      setReady(data.ready);
      setConfirmed(data.confirmed);
      // Media survives the login-gate redirect (saved fire-and-forget) — restore
      // it so the media step shows what was already uploaded.
      setMedia(data.media ?? { photos: [] });
      // The starter chip belongs to a FRESH conversation only (codex review).
      setQuickReplies([]);
    });
  }, []);

  // Generation progress clock: NO real per-step signal exists (generateDraftAction
  // is one awaited server action), so this ticks a plain elapsed-seconds counter
  // while phase is "generating" — the render below derives step/message/bar from
  // it. Resets on every entry (so a retry restarts the sequence) and is cleared
  // on exit, so it never keeps running once the phase moves on.
  useEffect(() => {
    if (phase !== "generating" && !inlineGen) return;
    setGenElapsed(0);
    const id = setInterval(() => setGenElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [phase, inlineGen]);

  // ---------------------------------------------------------------------------
  // Chat handlers
  // ---------------------------------------------------------------------------

  // One turn over the streaming endpoint (P4). Text deltas paint into the last
  // assistant bubble as they arrive; the trailing "final" event carries the
  // structured result. Refusals (rate limit etc.) come back as plain JSON.
  type TurnPayload = {
    message: string;
    facts: Partial<BusinessFacts>;
    verticalId: string;
    ready: boolean;
    confirmed: boolean;
    // W0: the model called start_generation this turn — the client must start
    // the same flow as the «Створити сайт» button (auth gate included).
    generate?: boolean;
    quickReplies: string[];
    // Media the agent's tools added this turn (scrape/analyze/set_media_role).
    media?: { photos: string[]; logoUrl?: string; photoMeta?: PhotoMeta[] };
  };

  // `modelMessages` go to the API (this turn's batch summary excluded — the
  // system prompt's media inventory already covers it); `uiBase` is what the
  // streamed reply paints onto; `mediaNow` is passed explicitly because the
  // closure's `media` is stale right after a batch.
  const streamTurn = async (
    modelMessages: ChatMsg[],
    uiBase: ChatMsg[],
    mediaNow: SiteMedia,
  ): Promise<TurnPayload> => {
    const res = await fetch("/api/onboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: modelMessages,
        facts,
        verticalId,
        media: mediaNow,
        conversationId: convIdRef.current,
      }),
    });
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      const j = (await res.json()) as { message?: string };
      if (typeof j.message === "string") {
        // Refusal (rate limit etc.) is message-only — carry the current state
        // through so a limited turn can't silently drop ready/confirmed.
        return {
          message: j.message,
          facts,
          verticalId: verticalId ?? "generic",
          ready,
          confirmed,
          generate: false,
          quickReplies: [],
        };
      }
      throw new Error("bad refusal payload");
    }
    if (!res.ok || !res.body) throw new Error(`stream failed: ${res.status}`);

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let acc = "";
    let final: TurnPayload | null = null;
    // {t:"generate"} arrives BEFORE {t:"final"} (which mirrors it as a field) —
    // remember it so a final that raced/omitted the flag still triggers.
    let generateSignal = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const chunks = buf.split("\n\n");
      buf = chunks.pop() ?? "";
      for (const c of chunks) {
        const line = c.trim();
        if (!line.startsWith("data:")) continue;
        let obj: { t?: string; text?: string; message?: string; name?: string; label?: string } & Partial<TurnPayload>;
        try {
          obj = JSON.parse(line.slice(5));
        } catch {
          continue;
        }
        if (obj.t === "tool" && typeof obj.label === "string") {
          // A tool started — show it as an inline status chip.
          const label = obj.label;
          setActiveTools((prev) => (prev.includes(label) ? prev : [...prev, label]));
        } else if (obj.t === "d" && typeof obj.text === "string") {
          if (!acc) {
            setTyping(false);
          }
          // The agent finished its tools and is answering — drop the chips.
          setActiveTools([]);
          acc += obj.text;
          setMessages([...uiBase, { role: "assistant", content: acc }]);
        } else if (obj.t === "generate") {
          // The agent called start_generation — the caller starts the same
          // flow as the «Створити сайт» button once the final state lands.
          generateSignal = true;
        } else if (obj.t === "final") {
          final = obj as TurnPayload;
        } else if (obj.t === "error") {
          throw new Error(obj.message || "stream error");
        }
        // Unknown event types are ignored on purpose — forward-compatible.
      }
    }
    if (!final) throw new Error("stream ended without final event");
    return { ...final, generate: Boolean(final.generate) || generateSignal };
  };

  // Instagram is no longer a separate client pipeline: a pasted IG link is a
  // normal chat message, and the onboarding agent calls its scrape_instagram
  // tool itself (04 §3). The imported facts/photos arrive via the {t:"final"}
  // media/facts merge, like any other agent turn.

  // Reset to a brand-new conversation (header ↺, confirm-gated). The old DB
  // row is simply abandoned — same as clearing the browser; nothing to delete
  // client-side. Local-only state: no server call, so it's instant.
  const resetChat = () => {
    localStorage.removeItem("vitryna_conv_id");
    convIdRef.current = null;
    for (const p of pending) URL.revokeObjectURL(p.thumbUrl);
    setPending([]);
    setMessages([igImportEnabled ? IG_GREETING : GREETING]);
    setFacts({});
    setReady(false);
    setConfirmed(false);
    setVerticalId(undefined);
    setInput("");
    setQuickReplies(igImportEnabled ? ["У мене є Instagram"] : []);
    setSavedNote(null);
    setMedia({ photos: [] });
    setPendingReviews([]);
    setUploadError(null);
    setActiveTools([]);
    setAutoGenerate(false);
    setDraft(null);
    setResetOpen(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // Core send — used by the input row AND by quick-reply chips. Carries the
  // composer's pending photo attachments: the batch uploads/analyzes in
  // parallel, routes into ONE aggregated summary, and only then (if there was
  // text) the normal agent turn runs.
  const send = async (raw: string) => {
    const text = raw.trim();
    const batch = pending;
    if ((!text && batch.length === 0) || loading) return;

    setUploadError(null);
    setSavedNote(null);
    setQuickReplies([]);
    setActiveTools([]);
    setLoading(true);

    // Lazily create the DB row BEFORE any optimistic UI (plan review): photo
    // uploads scope by conversationId, so a failed start must leave the
    // composer intact (text + attachments) instead of a dangling bubble.
    if (convIdRef.current === null) {
      const started = await startConversation();
      if (started) {
        convIdRef.current = started.conversationId;
        localStorage.setItem("vitryna_conv_id", started.conversationId);
      }
    }
    if (batch.length > 0 && !convIdRef.current) {
      setUploadError("Не вдалося завантажити фото — спробуйте трохи пізніше.");
      setLoading(false);
      return;
    }

    const notedBefore = new Set(doneLabels(facts));

    // Optimistic user bubble: local object-URL thumbnails until the upload
    // swaps them for storage URLs.
    const userMsg: ChatMsg = {
      role: "user",
      content: text,
      ...(batch.length > 0 && { attachments: batch.map((b) => b.thumbUrl) }),
    };
    let modelMessages: ChatMsg[] = [...messages, userMsg];
    let uiMessages: ChatMsg[] = modelMessages;
    let mediaNow = media;
    setMessages(uiMessages);
    setInput("");
    setPending([]);

    try {
      if (batch.length > 0) {
        setBatchCard({ thumbs: batch.map((b) => b.thumbUrl), done: 0, total: batch.length });
        const settled = await Promise.all(
          batch.map(async (item): Promise<BatchItem> => {
            try {
              const blob = await processImage(item.file);
              const ext = blob.type === "image/webp" ? "webp" : "jpg";
              const fd = new FormData();
              fd.append("file", blob, `photo.${ext}`);
              fd.append("conversationId", convIdRef.current as string);
              const res = await fetch("/api/upload", { method: "POST", body: fd });
              const json = (await res.json().catch(() => null)) as
                | { ok?: boolean; url?: string; warnings?: string[] }
                | null;
              if (!res.ok || !json?.url) return { failed: true };
              const analysis = await analyzePhotoAction(json.url);
              return { failed: false, url: json.url, analysis, warnings: json.warnings ?? [] };
            } catch {
              return { failed: true };
            } finally {
              setBatchCard((prev) => (prev ? { ...prev, done: prev.done + 1 } : prev));
            }
          }),
        );

        // Promise.all keeps INPUT order — routing (e.g. last-logo-wins) is
        // deterministic, not network-timing dependent.
        const uploaded = settled.flatMap((s) => (s.failed ? [] : [s.url]));
        const routed = routeBatch(media, settled);
        mediaNow = applyMediaLocal(routed.media);
        if (routed.reviews.length) setPendingReviews((prev) => [...prev, ...routed.reviews]);

        // Swap local thumbnails for storage URLs (failed uploads drop out). A
        // fully-failed photo-only send keeps no user message at all — an empty
        // bubble would persist and add an empty-content turn to history.
        const userMsgFinal: ChatMsg = {
          role: "user",
          content: text,
          ...(uploaded.length > 0 && { attachments: uploaded }),
        };
        const keepUserMsg = Boolean(text) || uploaded.length > 0;
        modelMessages = keepUserMsg ? [...messages, userMsgFinal] : [...messages];
        // The summary stays OUT of this turn's model input — the system
        // prompt's media inventory already reflects the uploads (G4).
        uiMessages = [...modelMessages, { role: "assistant", content: routed.summary }];
        setMessages(uiMessages);
        setBatchCard(null);
        for (const b of batch) URL.revokeObjectURL(b.thumbUrl);

        // Single write: summary message AND media together (wave G pattern —
        // two racing read-modify-writes could lose the fresh upload). AWAITED
        // (code review): applyResult fires its own saveTurn later with the
        // full message list; if this earlier, shorter write ever landed AFTER
        // it, the persisted conversation would lose the agent's reply.
        if (convIdRef.current) {
          await saveTurn(
            convIdRef.current,
            uiMessages,
            facts,
            verticalId,
            ready,
            confirmed,
            mediaNow,
          ).catch(() => {});
        }
      }

      // Photo-only send stops here — the summary (+ review cards) IS the reply.
      if (!text) return;

      setTyping(true);

      const applyResult = (result: TurnPayload) => {
        const finalMessages: ChatMsg[] = [...uiMessages, { role: "assistant", content: result.message }];
        setMessages(finalMessages);
        setFacts(result.facts);
        setReady(result.ready);
        setConfirmed(result.confirmed ?? false);
        setVerticalId(result.verticalId);
        setQuickReplies(result.quickReplies ?? []);

        // Merge media the agent's tools produced this turn (scrape/analyze/
        // set_media_role). The route returns the authoritative post-turn media
        // (what the client sent + tool additions), so adopt it — but only when
        // present (the non-stream fallback carries none). photoMeta is kept whole
        // (text_source entries feed the dossier, not the gallery).
        let effectiveMedia = mediaNow;
        if (result.media) {
          effectiveMedia = {
            photos: result.media.photos.slice(0, MAX_PHOTOS),
            ...(result.media.logoUrl && { logoUrl: result.media.logoUrl }),
            ...(result.media.photoMeta?.length && { photoMeta: result.media.photoMeta }),
          };
          setMedia(effectiveMedia);
        }

        // Agentic feedback: which facts the agent just recorded — a real diff,
        // not decoration (the questionnaire header chips are gone, W0 §0.5).
        const newly = doneLabels(result.facts).filter((l) => !notedBefore.has(l));
        setSavedNote(newly.length ? newly.join(", ") : null);

        // The agent called start_generation (C2: chat DOES, not promises) —
        // hand off to the button flow via the effect below, after state flushes.
        if (result.generate) setAutoGenerate(true);

        // Persist turn fire-and-forget — never blocks the UI. Media rides along
        // explicitly (loading gate = it can't be mid-change), so this write never
        // depends on racing the stored value back in.
        if (convIdRef.current) {
          void saveTurn(
            convIdRef.current,
            finalMessages,
            result.facts,
            result.verticalId,
            result.ready,
            result.confirmed ?? false,
            effectiveMedia,
          );
        }
      };

      try {
        applyResult(await streamTurn(modelMessages, uiMessages, mediaNow));
      } catch {
        // Streaming path failed (network, SSE parse, server) → the proven
        // non-stream server action still answers the turn (degraded: no tools).
        setTyping(true);
        applyResult(
          await onboardAction(modelMessages, facts, verticalId, { ready, confirmed }),
        );
      }
    } finally {
      setLoading(false);
      setTyping(false);
      setBatchCard(null);
      setActiveTools([]);
      // Return focus to input so the owner can keep typing
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleSend = () => send(input);

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Confirmed CTA → the optional media step (login gate comes AFTER it).

  // ---------------------------------------------------------------------------
  // Chat photo attachments (wave G) — the paperclip only ATTACHES files to the
  // composer; upload + vision analysis + routing run inside send(). The shared
  // `loading` flag keeps sends mutually exclusive.
  // ---------------------------------------------------------------------------

  // Append an assistant message from the review-confirm flow and persist it
  // fire-and-forget. `factsOverride` is passed by the review-save case, where
  // facts changed this turn and setFacts hasn't flushed into the closure.
  // Closure state is safe here for the same reason applyResult's is: the
  // `loading` gate keeps sends exclusive and the review cards are disabled
  // while loading — nothing else appends between the click and this call. (A
  // saveTurn INSIDE a setMessages updater would be a side effect during
  // render — React flags it.)
  const appendAssistant = (content: string, factsOverride?: Partial<BusinessFacts>) => {
    const next: ChatMsg[] = [...messages, { role: "assistant", content }];
    setMessages(next);
    if (convIdRef.current) {
      void saveTurn(
        convIdRef.current,
        next,
        factsOverride ?? facts,
        verticalId,
        ready,
        confirmed,
        media,
      );
    }
  };

  // Apply a media change locally WITHOUT the media-step's saveMediaAction —
  // in the batch flow persistence rides send()'s single saveTurn write
  // together with the summary message.
  const applyMediaLocal = (next: SiteMedia): SiteMedia => {
    const clean: SiteMedia = { ...next, photoMeta: pruneMeta(next) };
    setMedia(clean);
    return clean;
  };

  // Attach picked files to the composer (no server calls yet). Caps at
  // MAX_PHOTOS per message; extras are dropped with an inline hint.
  const addFiles = (files: File[]) => {
    if (loading || files.length === 0) return;
    const room = MAX_PHOTOS - pending.length;
    setUploadError(files.length > room ? `Можна прикріпити до ${MAX_PHOTOS} фото за раз.` : null);
    const taken = files.slice(0, Math.max(0, room)).map((file) => ({
      id: attachId(),
      file,
      thumbUrl: URL.createObjectURL(file),
    }));
    if (taken.length) setPending([...pending, ...taken]);
  };

  const removePending = (id: string) => {
    const item = pending.find((p) => p.id === id);
    if (item) URL.revokeObjectURL(item.thumbUrl);
    setPending(pending.filter((p) => p.id !== id));
  };

  // Confirm/decline the FIRST queued review card; the next one (if any)
  // surfaces automatically.
  const saveReview = () => {
    const current = pendingReviews[0];
    if (!current) return;
    const author = current.author.trim() || "Клієнт";
    const newFacts: Partial<BusinessFacts> = {
      ...facts,
      testimonials: [...(facts.testimonials ?? []), { quote: current.quote, author }],
    };
    setFacts(newFacts);
    setSavedNote("Відгук");
    setPendingReviews(pendingReviews.slice(1));
    appendAssistant("Зберіг відгук — він зʼявиться на сайті. Дякую!", newFacts);
  };

  const declineReview = () => setPendingReviews(pendingReviews.slice(1));

  // Confirm → straight to generation (owner decision: no media step — IG photos
  // are already in; with none we generate images in the background and the site
  // shows shimmer placeholders). Login-gated: the draft preview is authed.
  // `inline` = triggered by the agent's start_generation signal: same auth
  // gate, same runGenerate, but the progress card renders in the chat column.
  const handleCreateSite = async (opts?: { inline?: boolean }) => {
    if (loading) return;
    setLoading(true);
    try {
      const s = await sessionStateAction();
      // Auth on + not signed in → warm gate (save the site), not generation.
      // Honesty (C2): the stream may have just said «Запускаю створення
      // сайту…», but nothing generates for an anonymous visitor — and
      // autoGenerate does not survive the login redirect, so say what will
      // ACTUALLY happen. Persisted via appendAssistant, so the restored
      // conversation after sign-in still points at the button.
      if (s.authOn && !s.loggedIn) {
        appendAssistant(
          "Щоб зберегти сайт за вами, спершу увійдіть. Після входу натисніть «Створити сайт» — і я зберу чернетку.",
        );
        setPhase("gate");
        return;
      }
    } catch (err) {
      // Without this catch a failed action (e.g. deployment skew 404) escaped
      // and the CTA just looked dead — no state change, no message.
      setErrorMsg(actionErrorMessage(err));
      setPhase("error");
      return;
    } finally {
      setLoading(false);
    }
    await runGenerate(opts);
  };

  // Consume the {t:"generate"} signal ONE render after applyResult set it —
  // by now facts/media/verticalId are flushed, so generation reads this
  // turn's saved facts, not the stale send() closure. Guarded exactly like
  // the button: not mid-request, chat phase only.
  useEffect(() => {
    if (!autoGenerate || loading || phase !== "chat") return;
    setAutoGenerate(false);
    void handleCreateSite({ inline: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGenerate, loading, phase]);

  // ---------------------------------------------------------------------------
  // Generation moved earlier (04 §2/§4): confirmed facts → a real DRAFT the
  // owner previews, then publishes by hand (invariant 6). W0 (plan C7): the
  // only client requirement is a business name + ANY contact channel — the
  // server backstop in generateDraftAction mirrors exactly this.
  // ---------------------------------------------------------------------------

  const runGenerate = async (opts?: { inline?: boolean }) => {
    const businessName = (facts.businessName ?? "").trim();
    // Defense in depth — mirrors the server backstop (name + phone/telegram/
    // instagram/viber). If it fires, say WHAT is missing and drop confirmed
    // so the CTA hides.
    if (!businessName || !hasContactChannel(facts)) {
      const missing = [
        !businessName && "назва бізнесу",
        !hasContactChannel(facts) && "хоч один контакт (телефон, Instagram, Telegram або Viber)",
      ]
        .filter(Boolean)
        .join(" і ");
      setConfirmed(false);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Для сайту ще бракує: ${missing}. Напишіть — і продовжимо.`,
        },
      ]);
      setPhase("chat");
      return;
    }

    const fullFacts: Partial<BusinessFacts> = {
      ...facts,
      businessName,
      ...(facts.services && { services: facts.services.filter((s) => s.name.trim()) }),
    };

    setLoading(true);
    if (opts?.inline) setInlineGen(true);
    else setPhase("generating");

    try {
      const result = await generateDraftAction(
        fullFacts,
        verticalId,
        media,
        convIdRef.current ?? undefined,
      );
      if (result.ok) {
        setDraft({ host: result.host, previewUrl: result.previewUrl, editUrl: result.editUrl });
        setPhase("preview");
      } else if (result.authRequired) {
        // Session lapsed between the gate check and submit — send them to sign in.
        setPhase("gate");
      } else {
        setErrorMsg(result.error);
        setPhase("error");
      }
    } catch (err) {
      setErrorMsg(actionErrorMessage(err));
      setPhase("error");
    } finally {
      setLoading(false);
      setInlineGen(false);
    }
  };

  // Preview → HUMAN publish (invariant 6): publish the draft, celebrate.
  // Free since 2026-08-06 — nothing stands between this click and the live site.
  // The ₴999 is sold one screen later, for the owner's own domain.
  const handlePublish = async () => {
    if (loading || !draft) return;
    setLoading(true);
    try {
      const result = await finalizeAction(draft.host, convIdRef.current ?? undefined);
      if (result.ok) {
        setSiteUrl(result.url);
        setPhase("done");
        // Conversation is complete — clear localStorage so next visit starts fresh.
        localStorage.removeItem("vitryna_conv_id");
      } else if (result.authRequired) {
        setPhase("gate");
      } else {
        setErrorMsg(result.error);
        setPhase("error");
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Невідома помилка");
      setPhase("error");
    } finally {
      setLoading(false);
    }
  };

  // ViewContent = «побачив свій сайт», the moment the funnel is really working.
  // Fired once per session, when the preview screen first mounts.
  const viewContentSent = useRef(false);
  useEffect(() => {
    if (phase !== "preview" || viewContentSent.current) return;
    viewContentSent.current = true;
    pixelTrack("ViewContent");
    phCapture("ui_preview_shown");
  }, [phase]);

  // «Сайт живий», once per session. The success screen re-renders freely (the
  // domain card below it has its own state), so «shown» has to mean «first
  // reached», not «drawn» — one owner publishing once must not read as two.
  const publishSuccessSent = useRef(false);
  useEffect(() => {
    if (phase !== "done" || publishSuccessSent.current) return;
    publishSuccessSent.current = true;
    phCapture("ui_publish_success", {
      surface: "onboard",
      ...(draft?.host ? { host: draft.host } : {}),
    });
  }, [phase, draft?.host]);

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(siteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the URL is visible above, no fallback needed */
    }
  };

  const rootBase = "bg-canvas text-ink";

  // While the big «Створити сайт» CTA is on screen, hide any quick-reply chip
  // with the same wording — the model likes to suggest it, and two identical
  // buttons read as a bug.
  const visibleQuickReplies = confirmed
    ? quickReplies.filter((q) => q.trim().toLowerCase() !== "створити сайт")
    : quickReplies;

  // ---------------------------------------------------------------------------
  // Render — chat phase (design B: merged progress chips + quick-reply chips)
  // ---------------------------------------------------------------------------

  if (phase === "chat") {
    return (
      <div className={`h-[100dvh] ${rootBase} lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(400px,32%)]`}>
        <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />
        <ConfirmDialog
          open={resetOpen}
          title="Почати нову розмову?"
          body="Поточна розмова і зібрані дані зникнуть. Завантажені фото можна буде додати ще раз."
          confirmLabel="Почати заново"
          onConfirm={resetChat}
          onCancel={() => setResetOpen(false)}
        />
        <div className="flex h-full min-h-0 flex-col">

        {/* Header: honey «3» avatar + Помічник + status */}
        <header className="border-b border-line bg-surface/85 backdrop-blur">
          <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-4 py-2.5">
            <Link
              href="/"
              aria-label="Назад"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-sunken hover:text-ink"
            >
              <ArrowLeft size={20} />
            </Link>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-honey font-brand text-[19px] font-semibold text-honey-text">
              3
            </span>
            <div className="flex flex-col leading-tight">
              <span className="font-brand text-[17px] font-semibold text-ink">Помічник</span>
              {/* Static — the tool/typing indicator below the messages is the
                  sole "agent is working" signal; swapping this label too
                  read as a redundant third indicator (owner feedback). */}
              <span className="flex items-center gap-1.5 text-[13px] font-bold text-ok">
                <span className="h-1.5 w-1.5 rounded-full bg-ok" aria-hidden />
                онлайн
              </span>
            </div>
            {/* Reset only makes sense once the user actually said something. */}
            {messages.length > 1 && (
              <button
                onClick={() => setResetOpen(true)}
                disabled={loading}
                aria-label="Почати нову розмову"
                title="Почати нову розмову"
                className="ml-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-sunken hover:text-ink disabled:opacity-45"
              >
                <RotateCcw size={19} />
              </button>
            )}
          </div>
          {/* The questionnaire progress bar + chips are GONE (W0, plan §0.5):
              they read as a form and dictated the question script. The
              agent-status tool card in the message column is the sole
              «видима робота» signal now. */}
        </header>

        {/* Messages */}
        <div ref={chatScrollRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-3.5 px-4 py-6">
            {/* Promise chip only while the conversation is still warming up
                (C3): once the agent is ready to generate, the CTA/signal is
                the promise. */}
            {!ready && (
              <div className="flex items-center gap-1.5 self-center rounded-full bg-honey/15 px-3.5 py-1.5 text-[13px] font-bold text-honey-text">
                <Sparkles size={14} />
                Сайт буде готовий за ~3 хвилини
              </div>
            )}

            {messages.map((msg, i) => (
              <ChatBubble
                key={i}
                msg={msg}
                streaming={loading && msg.role === "assistant" && i === messages.length - 1}
              />
            ))}

            {savedNote && !typing && (
              <span className="ml-[42px] self-start rounded-full bg-ok-soft px-3 py-1 text-[13px] font-bold text-ok">
                ✓ Записано: {savedNote}
              </span>
            )}

            {batchCard && (
              <div className="flex items-start gap-2.5">
                <AgentAvatar busy />
                <div className="flex items-center gap-3 rounded-[22px] rounded-tl-[8px] border border-line bg-surface px-4 py-3 shadow-[0_1px_2px_rgba(51,41,28,0.05)]">
                  <div className="flex -space-x-3">
                    {batchCard.thumbs.slice(0, 3).map((t, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={i}
                        src={t}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded-[12px] border-2 border-surface object-cover"
                      />
                    ))}
                  </div>
                  <span className="text-[14px] font-semibold text-ink-muted">
                    {batchCard.total === 1
                      ? "Роздивляюсь фото…"
                      : `Роздивляюсь фото… ${Math.min(batchCard.done + 1, batchCard.total)} з ${batchCard.total}`}
                  </span>
                </div>
              </div>
            )}

            {/* ONE working indicator at a time, never two together: the tool
                card wins while any tool is running; otherwise the typing
                bubble covers extended thinking AND the plain pre-first-token
                wait (both look identical to the owner). Once text starts
                streaming, `typing` flips false and the growing bubble is the
                only signal — no indicator at all. */}
            {activeTools.length > 0 ? (
              <div className="flex items-start gap-2.5">
                <AgentAvatar busy />
                <div className="min-w-0 rounded-[22px] rounded-tl-[8px] border border-line bg-surface px-4 py-3 shadow-[0_1px_2px_rgba(51,41,28,0.05)]">
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                    Працюю над сайтом
                  </p>
                  <ul className="flex flex-col gap-2">
                    {activeTools.map((label, i) => (
                      <li
                        key={`${label}-${i}`}
                        className="flex items-center gap-2.5 text-[15px] font-semibold text-ink"
                      >
                        <span
                          className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-honey border-t-transparent"
                          aria-hidden
                        />
                        {label}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              typing && <AgentTyping />
            )}

            {/* Inline generation card (W0, C2/C6-мінімум): the agent called
                start_generation, so the work happens right here in the chat —
                the same paced steps as the full-screen phase, as a card.
                Full Lovable-style cards land in wave V4. */}
            {inlineGen &&
              (() => {
                const gp = genProgress(genElapsed);
                return (
                  <div className="flex items-start gap-2.5">
                    <AgentAvatar busy />
                    <div className="min-w-0 max-w-[85%] flex-1 rounded-[22px] rounded-tl-[8px] border border-line bg-surface px-[18px] py-4 shadow-[0_1px_2px_rgba(51,41,28,0.05)] sm:max-w-[75%]">
                      <p className="text-[16px] font-bold text-ink">Генеруємо ваш сайт…</p>
                      <p className="mt-1 text-[14px] leading-relaxed text-ink-muted">
                        {GEN_MESSAGES[gp.msgIndex]}
                      </p>
                      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-sunken">
                        <div
                          className="relative h-2 overflow-hidden rounded-full bg-honey transition-all duration-1000 ease-out"
                          style={{ width: `${gp.barPct}%` }}
                        >
                          <span
                            className="absolute inset-y-0 left-0 w-1/3 bg-white/50"
                            style={{ animation: "ob-shimmer 1.6s ease-in-out infinite" }}
                            aria-hidden
                          />
                        </div>
                      </div>
                      <div className="mt-3 flex flex-col gap-2">
                        {GEN_STEPS.map((label, i) => (
                          <GenStep
                            key={label}
                            state={i < gp.stepIndex ? "done" : i === gp.stepIndex ? "active" : "pending"}
                          >
                            {label}
                          </GenStep>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}

          </div>
        </div>

        {/* Footer: confirmed CTA + quick replies + input. The big CTA appears
            only AFTER the user explicitly confirmed the chat summary (A6).
            The model sometimes suggests «Створити сайт» as a quick reply too —
            next to the real CTA that chip is a confusing duplicate, so it is
            filtered out while the CTA is visible. */}
        <footer className="border-t border-line bg-surface/70 backdrop-blur">
          <div className="mx-auto w-full max-w-2xl px-4 pb-5 pt-3.5">
          {confirmed && (
            <button
              onClick={() => void handleCreateSite()}
              disabled={loading}
              className="animate-pop mb-3 flex min-h-[60px] w-full items-center justify-center gap-2 rounded-[18px] bg-brand text-[18px] font-bold text-white shadow-[0_10px_28px_rgba(51,41,28,0.22)] transition-colors hover:bg-brand-hover disabled:opacity-50"
            >
              Створити сайт
              <ArrowRight size={20} />
            </button>
          )}

          {visibleQuickReplies.length > 0 && !loading && (
            <div className="mb-3">
              <p className="mb-2 flex items-center gap-1.5 text-[12px] font-bold text-ink-muted">
                <Sparkles size={14} className="text-honey" />
                Підказки — оберіть або напишіть своє
              </p>
              <div className="flex flex-wrap gap-2">
                {visibleQuickReplies.map((q) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    className="animate-pop rounded-full border border-line-strong bg-surface px-[18px] py-2.5 text-[15px] font-bold text-ink transition-all hover:-translate-y-0.5 hover:border-honey hover:bg-honey/10"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Reviews OCR'd from screenshots — the owner confirms each before it
              becomes a fact (invariant №5). One card at a time. */}
          {pendingReviews.length > 0 && (
            <div className="animate-pop mb-3 flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-4 shadow-card">
              <span className="flex items-center gap-1.5 text-[15px] font-bold text-ink">
                <Sparkles size={15} className="shrink-0 text-honey" />
                {pendingReviews.length > 1
                  ? `Знайшов відгук на скріншоті (ще ${pendingReviews.length - 1} у черзі):`
                  : "Знайшов відгук на скріншоті:"}
              </span>
              <p className="whitespace-pre-wrap rounded-[14px] bg-sunken px-3.5 py-3 text-[15px] leading-relaxed text-ink">
                {pendingReviews[0].quote}
              </p>
              <input
                type="text"
                value={pendingReviews[0].author}
                onChange={(e) =>
                  setPendingReviews((prev) =>
                    prev.length ? [{ ...prev[0], author: e.target.value }, ...prev.slice(1)] : prev,
                  )
                }
                placeholder="Імʼя клієнта (необовʼязково)"
                autoComplete="off"
                className="h-12 w-full rounded-full border border-line-strong bg-surface px-4 text-[15px] text-ink placeholder:text-ink-faint focus:border-honey-deep focus:outline-none focus:ring-4 focus:ring-honey/20"
              />
              <div className="flex gap-2.5">
                {/* Gated by `loading`: saving while a chat turn streams would let
                    applyResult overwrite facts without this testimonial. */}
                <Button size="md" disabled={loading} onClick={saveReview} className="flex-1">
                  Зберегти відгук
                </Button>
                <Button variant="quiet" size="md" disabled={loading} onClick={declineReview} className="flex-1">
                  Не зберігати
                </Button>
              </div>
            </div>
          )}

          {/* Pending attachments — local previews, removable until sent. */}
          {pending.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {pending.map((p) => (
                <div key={p.id} className="animate-pop relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.thumbUrl}
                    alt=""
                    className="h-14 w-14 rounded-[14px] border border-line object-cover shadow-[0_1px_2px_rgba(51,41,28,0.06)]"
                  />
                  <button
                    onClick={() => removePending(p.id)}
                    disabled={loading}
                    aria-label="Прибрати фото"
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-[12px] font-bold leading-none text-white transition-colors hover:bg-brand-hover"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2.5">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                addFiles(Array.from(e.target.files ?? []));
                e.target.value = ""; // allow re-picking the same file
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              aria-label="Додати фото"
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface text-ink-muted transition-colors hover:border-honey hover:bg-honey/10 hover:text-honey-text disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Paperclip size={22} />
            </button>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              placeholder={confirmed ? "Або допишіть щось…" : "Написати…"}
              autoComplete="off"
              className="h-14 min-w-0 flex-1 rounded-full border border-line-strong bg-surface px-5 text-[17px] text-ink placeholder:text-ink-faint transition-shadow focus:border-honey-deep focus:outline-none focus:ring-4 focus:ring-honey/20 disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={loading || (!input.trim() && pending.length === 0)}
              aria-label="Надіслати"
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand text-white shadow-[0_6px_18px_rgba(51,41,28,0.18)] transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none"
            >
              <SendArrow />
            </button>
          </div>

          {uploadError && (
            <p className="mt-2 pl-1 text-[14px] font-semibold text-danger">{uploadError}</p>
          )}
          </div>
        </footer>
        </div>

        <SitePreviewPanel
          facts={facts}
          verticalId={verticalId}
          photosCount={media.photos.length}
          hasLogo={!!media.logoUrl}
          className="hidden lg:flex"
        />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render — media step (§4.8): optional logo + photos before the confirm form
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Render — draft preview (04 §2): the generated draft, live, awaiting the
  // owner's own «Опублікувати» tap (publish is human-only, invariant 6).
  // ---------------------------------------------------------------------------

  if (phase === "preview" && draft) {
    return (
      <div className={`flex min-h-[100dvh] flex-col ${rootBase}`}>
        <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />
        <header className="border-b border-line bg-surface/85 backdrop-blur">
          <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-3.5">
            <button
              onClick={() => setPhase("chat")}
              disabled={loading}
              aria-label="Назад до розмови"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-sunken hover:text-ink disabled:opacity-45"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex flex-col leading-tight">
              <span className="font-brand text-[18px] font-semibold text-ink">
                Ваш сайт готовий до публікації
              </span>
              <span className="text-[13px] font-bold text-ink-muted">
                Перегляньте — і опублікуйте безкоштовно, коли все влаштовує
              </span>
            </div>
          </div>
        </header>

        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-5">
          <div className="flex flex-1 flex-col overflow-hidden rounded-[24px] border border-line bg-surface p-2 shadow-card">
            {/* Browser chrome around the live draft — the frame only; the iframe
                renders the real tenant site and is never styled from here. */}
            <div className="flex items-center gap-2 px-2 py-2">
              <span className="flex gap-1.5">
                {["#E6A5A0", "#EFC776", "#A9C9A4"].map((c) => (
                  <span key={c} className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c }} />
                ))}
              </span>
              <span className="ml-1 flex-1 truncate rounded-full bg-sunken px-3 py-1 text-[12px] font-semibold text-ink-faint">
                {draft.host}
              </span>
            </div>
            <iframe
              src={draft.previewUrl}
              title="Попередній перегляд сайту"
              className="min-h-[420px] w-full flex-1 rounded-[16px] border border-line bg-canvas"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Button
              size="lg"
              disabled={loading}
              onClick={() => void handlePublish()}
              className="min-h-[60px] w-full text-[19px] shadow-[0_10px_28px_rgba(51,41,28,0.22)]"
            >
              {loading ? "Публікую…" : "Опублікувати сайт"}
            </Button>
            <div className="flex gap-2">
              <Link
                href={draft.editUrl}
                className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-[16px] border border-line-strong bg-surface text-[16px] font-bold text-ink transition-colors hover:bg-sunken"
              >
                <Pencil size={17} /> Відредагувати
              </Link>
              <Button
                variant="quiet"
                size="md"
                disabled={loading}
                onClick={() => void runGenerate()}
                className="flex-1"
              >
                Згенерувати ще раз
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render — login gate (journal #43): save the site behind an account
  // ---------------------------------------------------------------------------

  if (phase === "gate") {
    return (
      <div className={`flex min-h-[100dvh] flex-col items-center justify-center px-6 ${rootBase}`}>
        <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />
        <div className="animate-rise flex w-full max-w-md flex-col items-center text-center">
          <span className="flex h-24 w-24 items-center justify-center rounded-full bg-honey font-brand text-[42px] font-semibold text-honey-text shadow-[0_18px_40px_-14px_rgba(51,41,28,0.4)]">
            3
          </span>
          <h2 className="mt-8 font-brand text-[24px] font-semibold leading-tight">
            Створіть акаунт, щоб зберегти ваш сайт
          </h2>
          <p className="mt-3 text-[17px] leading-relaxed text-ink-muted">
            Розмова збережеться — ви продовжите з того самого місця
          </p>
          <Link
            href="/login?next=/new"
            className="mt-8 flex min-h-14 w-full items-center justify-center gap-2 rounded-[16px] bg-brand px-7 text-[18px] font-bold text-white shadow-[0_10px_28px_rgba(51,41,28,0.22)] transition-colors hover:bg-brand-hover"
          >
            Увійти або зареєструватися
          </Link>
          <Button variant="quiet" size="md" className="mt-2" onClick={() => setPhase("chat")}>
            <ArrowLeft size={17} /> Назад до розмови
          </Button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render — generating (design D)
  // ---------------------------------------------------------------------------

  if (phase === "generating") {
    // Derived from the plain elapsed-seconds clock (effect above) — no real
    // per-step signal exists, so this only has to feel like steady progress
    // across the real ~3-minute budget, never finish early, and never freeze.
    const { stepIndex, msgIndex, barPct } = genProgress(genElapsed);

    return (
      <div className={`flex min-h-[100dvh] flex-col items-center justify-center px-8 ${rootBase}`}>
        <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />
        <div className="flex w-full max-w-md flex-col items-center">
          <span
            className="flex h-24 w-24 items-center justify-center rounded-full bg-honey font-brand text-[42px] font-semibold text-honey-text"
            style={{ animation: "ob-pulse 2.6s ease-in-out infinite" }}
          >
            3
          </span>
          <h2 className="mt-8 text-center font-brand text-[24px] font-semibold">Генеруємо ваш сайт…</h2>
          <p className="mt-3 text-center text-[17px] leading-relaxed text-ink-muted">
            {GEN_MESSAGES[msgIndex]}
          </p>

          <div className="mt-8 h-2.5 w-full overflow-hidden rounded-full bg-sunken">
            <div
              className="relative h-2.5 overflow-hidden rounded-full bg-honey transition-all duration-1000 ease-out"
              style={{ width: `${barPct}%` }}
            >
              {/* Perpetual shimmer — the bar must never look frozen, even
                  while its width sits still between step ticks. */}
              <span
                className="absolute inset-y-0 left-0 w-1/3 bg-white/50"
                style={{ animation: "ob-shimmer 1.6s ease-in-out infinite" }}
                aria-hidden
              />
            </div>
          </div>

          <div className="mt-7 flex w-full flex-col gap-2.5">
            {GEN_STEPS.map((label, i) => (
              <GenStep key={label} state={i < stepIndex ? "done" : i === stepIndex ? "active" : "pending"}>
                {label}
              </GenStep>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render — success (design D). No "register to manage" link — flow removed.
  // ---------------------------------------------------------------------------

  if (phase === "done") {
    const displayUrl = siteUrl.replace(/^https?:\/\//, "");
    // Editor route key = tenant host (hostname strips the dev :port).
    let editHost = "";
    try {
      editHost = new URL(siteUrl).hostname;
    } catch {
      /* keep "" — the edit link just doesn't render */
    }
    return (
      <div className={`relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-6 ${rootBase}`}>
        <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />
        <Confetti />
        <div className="animate-rise flex w-full max-w-md flex-col items-center text-center">
          <div className="animate-pop flex h-[72px] w-[72px] items-center justify-center rounded-full bg-honey text-honey-text shadow-[0_18px_40px_-14px_rgba(51,41,28,0.4)]">
            <PartyPopper size={34} />
          </div>
          <h2 className="mt-6 font-brand text-[26px] font-semibold">Ваш сайт готовий!</h2>
          <p className="mt-2.5 text-[17px] text-ink-muted">
            Він уже працює — безкоштовно — за адресою:
          </p>

          <Card className="mt-5 flex w-full flex-col gap-3.5 p-5">
            <span className="break-all text-center font-brand text-[18px] font-semibold text-ink">
              {displayUrl}
            </span>
            <div className="flex gap-2.5">
              <a
                href={siteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-[54px] flex-[1.3] items-center justify-center rounded-[16px] bg-brand text-[16px] font-bold text-white shadow-[0_8px_22px_rgba(51,41,28,0.2)] transition-colors hover:bg-brand-hover"
              >
                Відкрити сайт ↗
              </a>
              <button
                onClick={copyUrl}
                className="flex h-[54px] flex-1 items-center justify-center rounded-[16px] border border-line-strong bg-surface text-[16px] font-bold text-ink transition-colors hover:bg-sunken"
              >
                {copied ? "Скопійовано ✓" : "Копіювати"}
              </button>
            </div>
          </Card>

          <p className="mt-3 text-[14px] text-ink-muted">
            Перегляньте сайт — фото й зображення можна замінити в редакторі.
          </p>

          {/* Domain step — the ONE paid step (owner decision 2026-08-06).
              Skippable: the site is already live on its subdomain. */}
          {draft && <DomainStep host={draft.host} />}

          <div className="mt-3.5 flex w-full items-center gap-3.5 rounded-[20px] border border-line bg-surface px-5 py-4 text-left shadow-card">
            <TelegramMark />
            <div className="min-w-0 flex-1">
              <div className="text-[16px] font-extrabold text-ink">Наступний крок — Telegram</div>
              <div className="text-[14px] font-semibold leading-snug text-ink-muted">
                Підключіть Telegram, щоб заявки від клієнтів приходили прямо вам
              </div>
            </div>
            <Link
              href="/sites"
              className="flex min-h-11 shrink-0 items-center justify-center rounded-full bg-tg px-5 text-[15px] font-bold text-white transition-colors hover:bg-tg-dark"
            >
              Підключити
            </Link>
          </div>

          {/* Exits: the success screen must never be a dead end. */}
          <div className="mt-6 flex w-full flex-col gap-2">
            {editHost && (
              <Link
                href={`/edit/${editHost}`}
                className="flex h-[54px] w-full items-center justify-center gap-2 rounded-[16px] border border-line-strong bg-surface text-[16px] font-bold text-ink transition-colors hover:bg-sunken"
              >
                <Pencil size={17} /> Редагувати сайт
              </Link>
            )}
            <Link
              href="/sites"
              className="flex min-h-11 items-center justify-center text-[15px] font-bold text-ink-muted transition-colors hover:text-ink"
            >
              Мої сайти →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render — error
  // ---------------------------------------------------------------------------

  return (
    <div className={`flex min-h-[100dvh] flex-col items-center justify-center px-6 ${rootBase}`}>
      <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />
      <div className="animate-rise flex w-full max-w-md flex-col items-center text-center">
        <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-danger-soft text-danger">
          <CircleAlert size={34} />
        </div>
        <h2 className="mt-6 font-brand text-[24px] font-semibold">Щось пішло не так</h2>
        <p className="mt-4 w-full rounded-[16px] bg-danger-soft px-5 py-4 text-[15px] font-semibold leading-relaxed text-danger">
          {errorMsg}
        </p>
        <Button size="lg" className="mt-6" onClick={() => void (draft ? handlePublish() : runGenerate())}>
          Спробувати ще раз
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small local sub-components + shared class strings
// ---------------------------------------------------------------------------

// Markdown-lite for agent replies: only **bold** is supported (the prompt
// forbids everything else). Built as React nodes — no HTML injection surface.
function renderBold(text: string): ReactNode[] {
  return text
    .split(/\*\*([^*]+)\*\*/g)
    .map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part));
}

// Honey mark that fronts every assistant turn (bubble, typing, tool card) —
// the reference's assistant avatar. `busy` swaps in a spinning ring.
function AgentAvatar({ busy = false }: { busy?: boolean }) {
  return (
    <span
      className="relative mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-honey text-honey-text"
      aria-hidden
    >
      <Sparkles size={16} />
      {busy && (
        <span className="absolute inset-[-3px] animate-spin rounded-full border-2 border-honey border-t-transparent" />
      )}
    </span>
  );
}

function ChatBubble({ msg, streaming = false }: { msg: ChatMsg; streaming?: boolean }) {
  const isUser = msg.role === "user";
  const atts = msg.attachments ?? [];
  // SSE chunks land bursty; the smoothing hook types them out evenly.
  const shown = useSmoothText(msg.content, streaming && !isUser);
  if (!msg.content && atts.length === 0) return null;

  const body = (
    <>
      {atts.length > 0 && (
        <div className={`flex flex-wrap gap-1.5 ${msg.content ? "mb-2.5" : ""}`}>
          {atts.map((u, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={u} alt="" className="h-24 w-24 rounded-[14px] object-cover" />
          ))}
        </div>
      )}
      {msg.content !== "" && (
        <p className="whitespace-pre-wrap">
          {isUser ? msg.content : renderBold(shown)}
          {streaming && !isUser && (
            <span aria-hidden className="animate-blink text-honey">
              ▍
            </span>
          )}
        </p>
      )}
    </>
  );

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="animate-pop max-w-[85%] rounded-[22px] rounded-br-[8px] bg-brand px-[18px] py-3.5 text-[17px] leading-relaxed text-white shadow-[0_6px_16px_rgba(51,41,28,0.14)] sm:max-w-[75%]">
          {body}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2.5">
      <AgentAvatar />
      <div className="animate-rise max-w-[85%] rounded-[22px] rounded-tl-[8px] border border-line bg-surface px-[18px] py-3.5 text-[17px] leading-relaxed text-ink shadow-[0_1px_2px_rgba(51,41,28,0.05)] sm:max-w-[75%]">
        {body}
      </div>
    </div>
  );
}

// Working indicator: an assistant bubble with three pulsing dots. Shown
// whenever a turn is in flight and no text has streamed yet — extended
// thinking and the plain pre-first-token wait are indistinguishable to the
// owner, so the dots claim nothing about which one it is (the honest
// «Думаю…» label survives for screen readers). Mutually exclusive with the
// live tool card (04 §2) at the call site: never two indicators at once.
function AgentTyping() {
  return (
    <div className="flex items-start gap-2.5" role="status">
      <AgentAvatar />
      <div className="flex items-center gap-1.5 rounded-[22px] rounded-tl-[8px] border border-line bg-surface px-4 py-4 shadow-[0_1px_2px_rgba(51,41,28,0.05)]">
        {/* The honest label stays for assistive tech; sighted owners read the
            dots, which claim nothing about what the agent is doing. */}
        <span className="sr-only">Думаю…</span>
        <span className="h-2 w-2 animate-blink rounded-full bg-ink-faint [animation-delay:0ms]" aria-hidden />
        <span className="h-2 w-2 animate-blink rounded-full bg-ink-faint [animation-delay:200ms]" aria-hidden />
        <span className="h-2 w-2 animate-blink rounded-full bg-ink-faint [animation-delay:400ms]" aria-hidden />
      </div>
    </div>
  );
}

function GenStep({ state, children }: { state: "done" | "active" | "pending"; children: ReactNode }) {
  return (
    <div
      className={`flex items-center gap-2.5 text-[16px] ${
        state === "done"
          ? "font-bold text-ok"
          : state === "active"
            ? "font-bold text-ink"
            : "font-semibold text-ink-faint"
      }`}
    >
      {state === "done" ? (
        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-ok-soft text-[11px]" aria-hidden>
          ✓
        </span>
      ) : state === "active" ? (
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-[2.5px] border-honey border-t-transparent" aria-hidden />
      ) : (
        <span className="inline-block h-4 w-4 rounded-full border-2 border-line-strong" aria-hidden />
      )}
      <span>{children}</span>
    </div>
  );
}

function Confetti() {
  // Warm palette only: honey, deep ink, the soft-ok green — no leftover blue.
  const pieces = [
    { left: "16%", color: "#E9A23B", w: 10, h: 14, delay: 0, dur: 2.6 },
    { left: "38%", color: "#3A3128", w: 8, h: 12, delay: 0.4, dur: 3.1 },
    { left: "58%", color: "#177E53", w: 10, h: 10, delay: 0.8, dur: 2.8, round: true },
    { left: "80%", color: "#E9A23B", w: 8, h: 13, delay: 1.2, dur: 3.4 },
    { left: "27%", color: "#F2CE86", w: 9, h: 9, delay: 1.6, dur: 3, round: true },
    { left: "70%", color: "#3A3128", w: 9, h: 12, delay: 0.2, dur: 3.2 },
  ];
  return (
    <div className="pointer-events-none absolute inset-x-0 top-10 h-40" aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute top-0 block"
          style={{
            left: p.left,
            width: p.w,
            height: p.h,
            background: p.color,
            borderRadius: p.round ? 999 : 3,
            animation: `ob-confetti ${p.dur}s ease-in infinite ${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
