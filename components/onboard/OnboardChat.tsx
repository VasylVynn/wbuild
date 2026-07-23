"use client";

import {
  useState,
  useRef,
  useEffect,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { CircleAlert, PartyPopper, Paperclip, RotateCcw } from "lucide-react";
import type { ChatMsg, ProgressItem } from "@/lib/ai/onboard";
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
  saveMediaAction,
  loadConversation,
} from "@/app/app/new/persist-actions";
import type { BusinessFacts } from "@/lib/verticals/schema";
import { MAX_PHOTOS, type SiteMedia, type PhotoMeta } from "@/lib/media/media";
import { processImage } from "@/lib/media/client-image";
import { Button, Chip, Card, ConfirmDialog } from "@/components/ui";
import SitePreviewPanel from "@/components/onboard/SitePreviewPanel";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Phase = "chat" | "gate" | "generating" | "preview" | "done" | "error";

const GREETING: ChatMsg = {
  role: "assistant",
  content:
    "Вітаю! 👋 Я допоможу створити сайт для вашого бізнесу. Розкажіть трохи — що це за бізнес, у якому місті, і який телефон для звʼязку?",
};

// Instagram-first greeting (wave E) — shown only when the Apify scrape is
// configured server-side (igImportEnabled prop), so the promise is never empty.
// A pasted IG link is now a normal message: the agent calls scrape_instagram itself.
const IG_GREETING: ChatMsg = {
  role: "assistant",
  content:
    "Вітаю! 👋 Я допоможу створити сайт для вашого бізнесу. Розкажіть трохи — що це за бізнес і в якому місті? А якщо у вас є Instagram-сторінка бізнесу — просто надішліть посилання, і я витягну все звідти сам 😉",
};

// Progress chips mirror the server's computeProgress (lib/ai/onboard.ts): a pure
// function of `facts`, so we derive them client-side too — this keeps the header
// correct for the fresh greeting and for resumed conversations, where no server
// `result.progress` exists yet. After each turn it equals result.progress.
const PROGRESS_FIELDS: { key: keyof BusinessFacts; label: string }[] = [
  { key: "businessName", label: "Бізнес" },
  { key: "city", label: "Місто" },
  { key: "phone", label: "Телефон" },
  { key: "address", label: "Адреса" },
  { key: "hours", label: "Години" },
];
function deriveProgress(facts: Partial<BusinessFacts>): ProgressItem[] {
  return PROGRESS_FIELDS.map(({ key, label }) => {
    const v = facts[key];
    return { key, label, done: v != null && String(v).trim().length > 0 };
  });
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

// Design animations (design/D). Kept in-file so this component owns everything;
// prefixed `ob-` to avoid colliding with any global keyframes.
const KEYFRAMES = `
@keyframes ob-typing { 0%,60%,100% { transform: translateY(0); opacity: .5 } 30% { transform: translateY(-4px); opacity: 1 } }
@keyframes ob-genbar { 0% { width: 12% } 60% { width: 78% } 100% { width: 92% } }
@keyframes ob-float { 0%,100% { transform: translateY(0) rotate(-4deg) } 50% { transform: translateY(-10px) rotate(4deg) } }
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
  const [template, setTemplate] = useState<{ id: string; label: string } | null>(null);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  // Extended-thinking phase of the streaming turn — «Думаю…» label.
  const [thinking, setThinking] = useState(false);
  const [quickReplies, setQuickReplies] = useState<string[]>(
    igImportEnabled ? ["У мене є Instagram"] : [],
  );
  // «✓ Записав: …» під останньою відповіддю — реальний diff прогресу за хід.
  const [savedNote, setSavedNote] = useState<string | null>(null);

  // --- Shared loading flag (blocks all inputs while a request is in flight) ---
  const [loading, setLoading] = useState(false);

  // --- Phase ---
  const [phase, setPhase] = useState<Phase>("chat");

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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Hidden file input behind the paperclip button (chat photo upload, wave G).
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Holds the persisted conversation id after first user send; null = not yet created
  const convIdRef = useRef<string | null>(null);

  // Progress chips — derived, always in sync with the collected facts.
  const progress = deriveProgress(facts);

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

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

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
      if (data.templateId && data.templateLabel) {
        setTemplate({ id: data.templateId, label: data.templateLabel });
      }
      // Media survives the login-gate redirect (saved fire-and-forget) — restore
      // it so the media step shows what was already uploaded.
      setMedia(data.media ?? { photos: [] });
      // The starter chip belongs to a FRESH conversation only (codex review).
      setQuickReplies([]);
    });
  }, []);

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
    quickReplies: string[];
    templateId?: string;
    templateLabel?: string;
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
        templateId: template?.id,
        media: mediaNow,
        conversationId: convIdRef.current,
      }),
    });
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      const j = (await res.json()) as { message?: string };
      if (typeof j.message === "string") {
        // Refusal (rate limit etc.) is message-only — carry the current state
        // through so a limited turn can't silently drop ready/confirmed/template.
        return {
          message: j.message,
          facts,
          verticalId: verticalId ?? "generic",
          ready,
          confirmed,
          quickReplies: [],
          templateId: template?.id,
          templateLabel: template?.label,
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
        if (obj.t === "think") {
          setThinking(true);
        } else if (obj.t === "tool" && typeof obj.label === "string") {
          // A tool started — show it as an inline status chip.
          setThinking(false);
          const label = obj.label;
          setActiveTools((prev) => (prev.includes(label) ? prev : [...prev, label]));
        } else if (obj.t === "d" && typeof obj.text === "string") {
          if (!acc) {
            setTyping(false);
            setThinking(false);
          }
          // The agent finished its tools and is answering — drop the chips.
          setActiveTools([]);
          acc += obj.text;
          setMessages([...uiBase, { role: "assistant", content: acc }]);
        } else if (obj.t === "final") {
          final = obj as TurnPayload;
        } else if (obj.t === "error") {
          throw new Error(obj.message || "stream error");
        }
      }
    }
    if (!final) throw new Error("stream ended without final event");
    return final;
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
    setTemplate(null);
    setInput("");
    setQuickReplies(igImportEnabled ? ["У мене є Instagram"] : []);
    setSavedNote(null);
    setMedia({ photos: [] });
    setPendingReviews([]);
    setUploadError(null);
    setActiveTools([]);
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

    const progressBefore = new Set(
      deriveProgress(facts).filter((p) => p.done).map((p) => p.label),
    );

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
            template?.id,
            mediaNow,
          ).catch(() => {});
        }
      }

      // Photo-only send stops here — the summary (+ review cards) IS the reply.
      if (!text) return;

      setTyping(true);
      setThinking(false);

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

        // Last-wins: an existing pick must never be cleared by a result without
        // one (e.g. a later turn that doesn't touch the design).
        const nextTemplate =
          result.templateId && result.templateLabel
            ? { id: result.templateId, label: result.templateLabel }
            : template;
        setTemplate(nextTemplate);

        // Agentic feedback: which facts the agent just recorded — a real diff of
        // the same progress model as the header chips, not decoration.
        const newly = deriveProgress(result.facts)
          .filter((p) => p.done && !progressBefore.has(p.label))
          .map((p) => p.label);
        setSavedNote(newly.length ? newly.join(", ") : null);

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
            nextTemplate?.id,
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
          await onboardAction(modelMessages, facts, verticalId, template?.id, { ready, confirmed }),
        );
      }
    } finally {
      setLoading(false);
      setTyping(false);
      setThinking(false);
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
  // Media step (§4.8) — optional logo + up to 3 photos, saved fire-and-forget so
  // uploads survive the login-gate redirect. «Далі» and «Пропустити» share this.
  // ---------------------------------------------------------------------------

  // Persist to state AND to the conversation row (best-effort). Onboarding
  // uploads scope by conversationId; if there's no row yet (Supabase off) the
  // save is simply skipped.
  const persistMedia = (next: SiteMedia) => {
    // Drop meta entries whose url is neither a photo nor the logo (a removed or
    // swapped url leaves its class/alt behind otherwise).
    const clean: SiteMedia = { ...next, photoMeta: pruneMeta(next) };
    setMedia(clean);
    if (convIdRef.current) void saveMediaAction(convIdRef.current, clean);
  };

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
        template?.id,
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
  const handleCreateSite = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const s = await sessionStateAction();
      // Auth on + not signed in → warm gate (save the site), not generation.
      if (s.authOn && !s.loggedIn) {
        setPhase("gate");
        return;
      }
    } finally {
      setLoading(false);
    }
    await runGenerate();
  };

  // ---------------------------------------------------------------------------
  // Generation moved earlier (04 §2/§4): confirmed facts → a real DRAFT the
  // owner previews, then publishes by hand (invariant 6). The chat summary IS
  // the confirmation; the code-enforced ready-gate guarantees name/city/phone.
  // ---------------------------------------------------------------------------

  const runGenerate = async () => {
    const businessName = (facts.businessName ?? "").trim();
    const city = (facts.city ?? "").trim();
    const phone = (facts.phone ?? "").trim();
    // Defense in depth — should be unreachable behind the ready-gate. If it ever
    // fires, say WHAT is missing and drop confirmed so the CTA hides.
    if (!businessName || !city || !phone) {
      const missing = [!businessName && "назва бізнесу", !city && "місто", !phone && "телефон"]
        .filter(Boolean)
        .join(", ");
      setConfirmed(false);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Щоб створити сайт, мені ще потрібно: ${missing}. Напишіть, будь ласка?`,
        },
      ]);
      setPhase("chat");
      return;
    }

    const fullFacts: BusinessFacts = {
      ...facts,
      businessName,
      city,
      phone,
      ...(facts.services && { services: facts.services.filter((s) => s.name.trim()) }),
    };

    setLoading(true);
    setPhase("generating");

    try {
      const result = await generateDraftAction(
        fullFacts,
        verticalId,
        media,
        convIdRef.current ?? undefined,
        template?.id,
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
      setErrorMsg(err instanceof Error ? err.message : "Невідома помилка");
      setPhase("error");
    } finally {
      setLoading(false);
    }
  };

  // Preview → HUMAN publish (invariant 6): publish the draft, celebrate.
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

  // ---------------------------------------------------------------------------
  // Render — chat phase (design B: merged progress chips + quick-reply chips)
  // ---------------------------------------------------------------------------

  if (phase === "chat") {
    return (
      <div className={`h-[100dvh] ${rootBase} lg:grid lg:grid-cols-[minmax(0,1fr)_420px]`}>
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
        <header className="bg-surface">
          <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-4 py-2.5">
            <Link
              href="/"
              aria-label="Назад"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[20px] font-bold text-ink-muted hover:bg-sunken"
            >
              ←
            </Link>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-honey-soft font-brand text-[19px] font-semibold text-honey">
              3
            </span>
            <div className="flex flex-col leading-tight">
              <span className="text-[17px] font-extrabold text-ink">Помічник</span>
              <span className={`text-[13px] font-bold ${typing ? "text-ink-muted" : "text-ok"}`}>
                {typing ? "друкує…" : "онлайн"}
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
          {/* Progress chips */}
          <div className="border-b border-line">
            <div className="mx-auto flex w-full max-w-2xl items-center gap-2 overflow-x-auto px-4 pb-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <span className="mr-1 hidden shrink-0 text-[14px] font-bold text-ink-faint sm:inline">
                Зібрано:
              </span>
              {progress.map((p) => (
                <Chip key={p.key} tone={p.done ? "ok" : "neutral"} className="shrink-0 whitespace-nowrap">
                  {p.done ? `✓ ${p.label}` : p.label}
                </Chip>
              ))}
            </div>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-3.5 px-4 py-5">
            <div className="self-center rounded-full bg-sunken px-3.5 py-1.5 text-[13px] font-bold text-ink-muted">
              Сайт буде готовий за ~3 хвилини
            </div>

            {messages.map((msg, i) => (
              <ChatBubble key={i} msg={msg} />
            ))}

            {savedNote && !typing && (
              <div className="pl-1 text-[13px] font-bold text-ok">✓ Записав: {savedNote}</div>
            )}

            {batchCard && (
              <div className="flex justify-start">
                <div className="flex items-center gap-3 rounded-[20px_20px_20px_6px] border-[1.5px] border-line bg-surface px-4 py-3">
                  <div className="flex -space-x-3">
                    {batchCard.thumbs.slice(0, 3).map((t, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={i}
                        src={t}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded-[10px] border-2 border-surface object-cover"
                      />
                    ))}
                  </div>
                  <span
                    className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-brand border-t-transparent"
                    aria-hidden
                  />
                  <span className="text-[14px] font-semibold text-ink-muted">
                    {batchCard.total === 1
                      ? "Роздивляюсь фото…"
                      : `Роздивляюсь фото… ${Math.min(batchCard.done + 1, batchCard.total)} з ${batchCard.total}`}
                  </span>
                </div>
              </div>
            )}

            {/* Inline tool-status chips — the agent's tools running live (04 §2). */}
            {activeTools.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {activeTools.map((label, i) => (
                  <span
                    key={`${label}-${i}`}
                    className="flex items-center gap-2 rounded-full border-[1.5px] border-brand-soft bg-brand-soft px-3.5 py-2 text-[13px] font-bold text-brand"
                  >
                    <span
                      className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-brand border-t-transparent"
                      aria-hidden
                    />
                    {label}
                  </span>
                ))}
              </div>
            )}

            {typing && <AgentTyping thinking={thinking} />}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Footer: confirmed CTA + quick replies + input. The big CTA appears
            only AFTER the user explicitly confirmed the chat summary (A6). */}
        <footer className="mx-auto w-full max-w-2xl px-4 pb-5">
          {confirmed && (
            <button
              onClick={() => void handleCreateSite()}
              disabled={loading}
              className="mb-3 flex min-h-[60px] w-full items-center justify-center rounded-[18px] bg-brand text-[18px] font-bold text-white shadow-[0_8px_24px_rgba(27,91,191,0.35)] transition-colors hover:bg-brand-hover disabled:opacity-50"
            >
              Створити сайт →
            </button>
          )}

          {quickReplies.length > 0 && !loading && (
            <div className="mb-3 flex flex-wrap gap-2">
              {quickReplies.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="rounded-full border-[1.5px] border-line-strong bg-surface px-[18px] py-3 text-[15px] font-bold text-ink transition-colors hover:border-brand hover:text-brand"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Reviews OCR'd from screenshots — the owner confirms each before it
              becomes a fact (invariant №5). One card at a time. */}
          {pendingReviews.length > 0 && (
            <div className="mb-3 flex flex-col gap-3 rounded-[18px] border-[1.5px] border-line bg-surface p-4">
              <span className="text-[15px] font-bold text-ink">
                {pendingReviews.length > 1
                  ? `Знайшов відгук на скріншоті (ще ${pendingReviews.length - 1} у черзі):`
                  : "Знайшов відгук на скріншоті:"}
              </span>
              <p className="whitespace-pre-wrap rounded-[12px] bg-sunken px-3.5 py-3 text-[15px] leading-relaxed text-ink">
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
                className="h-12 w-full rounded-full border-[1.5px] border-line-strong bg-surface px-4 text-[15px] text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-soft"
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
                <div key={p.id} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.thumbUrl}
                    alt=""
                    className="h-14 w-14 rounded-[12px] border-[1.5px] border-line object-cover"
                  />
                  <button
                    onClick={() => removePending(p.id)}
                    disabled={loading}
                    aria-label="Прибрати фото"
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-[12px] font-bold leading-none text-white"
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
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-[1.5px] border-line-strong bg-surface text-ink-muted transition-colors hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-45"
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
              className="h-14 min-w-0 flex-1 rounded-full border-[1.5px] border-line-strong bg-surface px-5 text-[17px] text-ink placeholder:text-ink-faint transition-shadow focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-soft disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={loading || (!input.trim() && pending.length === 0)}
              aria-label="Надіслати"
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-45"
            >
              <SendArrow />
            </button>
          </div>

          {uploadError && (
            <p className="mt-2 pl-1 text-[14px] font-semibold text-danger">{uploadError}</p>
          )}
        </footer>
        </div>

        <SitePreviewPanel
          facts={facts}
          verticalId={verticalId}
          templateLabel={template?.label}
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
        <header className="border-b border-line bg-surface">
          <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-3.5">
            <button
              onClick={() => setPhase("chat")}
              disabled={loading}
              aria-label="Назад до розмови"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[20px] font-bold text-ink-muted hover:bg-sunken disabled:opacity-45"
            >
              ←
            </button>
            <div className="flex flex-col leading-tight">
              <span className="text-[18px] font-extrabold text-ink">Ваш сайт готовий до публікації</span>
              <span className="text-[13px] font-bold text-ink-muted">
                Перегляньте — і опублікуйте, коли все влаштовує
              </span>
            </div>
          </div>
        </header>

        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-5">
          <div className="flex-1 overflow-hidden rounded-[18px] border-[1.5px] border-line bg-surface shadow-[0_8px_24px_rgba(23,36,47,0.06)]">
            <iframe
              src={draft.previewUrl}
              title="Попередній перегляд сайту"
              className="h-full min-h-[420px] w-full"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Button
              size="lg"
              disabled={loading}
              onClick={() => void handlePublish()}
              className="min-h-[60px] w-full text-[19px] shadow-[0_8px_24px_rgba(27,91,191,0.3)]"
            >
              {loading ? "Публікую…" : "Опублікувати сайт"}
            </Button>
            <div className="flex gap-2">
              <Link
                href={draft.editUrl}
                className="flex h-[52px] flex-1 items-center justify-center rounded-[16px] border-[1.5px] border-line-strong bg-surface text-[16px] font-bold text-ink transition-colors hover:bg-sunken"
              >
                ✏️ Відредагувати
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
        <div className="flex w-full max-w-md flex-col items-center text-center">
          <span className="flex h-24 w-24 items-center justify-center rounded-full bg-honey-soft font-brand text-[42px] font-semibold text-honey">
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
            className="mt-8 flex min-h-14 w-full items-center justify-center gap-2 rounded-[16px] bg-brand px-7 text-[18px] font-bold text-white transition-colors hover:bg-brand-hover"
          >
            Увійти або зареєструватися
          </Link>
          <Button variant="quiet" size="md" className="mt-2" onClick={() => setPhase("chat")}>
            ← Назад до розмови
          </Button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render — generating (design D)
  // ---------------------------------------------------------------------------

  if (phase === "generating") {
    return (
      <div className={`flex min-h-[100dvh] flex-col items-center justify-center px-8 ${rootBase}`}>
        <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />
        <div className="flex w-full max-w-md flex-col items-center">
          <span
            className="flex h-24 w-24 items-center justify-center rounded-full bg-honey-soft font-brand text-[42px] font-semibold text-honey"
            style={{ animation: "ob-float 2.4s ease-in-out infinite" }}
          >
            3
          </span>
          <h2 className="mt-8 text-center font-brand text-[24px] font-medium">Генеруємо ваш сайт…</h2>
          <p className="mt-3 text-center text-[17px] leading-relaxed text-ink-muted">
            Це може зайняти до 30 секунд. Нікуди не йдіть — уже майже готово.
          </p>

          <div className="mt-8 h-2.5 w-full overflow-hidden rounded-full bg-brand-soft">
            <div
              className="h-2.5 rounded-full bg-brand"
              style={{ animation: "ob-genbar 24s ease-out forwards" }}
            />
          </div>

          <div className="mt-7 flex w-full flex-col gap-2.5">
            <GenStep state="done">Тексти про ваш бізнес</GenStep>
            <GenStep state="done">Послуги та ціни</GenStep>
            <GenStep state="active">Оформлення і кольори…</GenStep>
            <GenStep state="pending">Форма замовлення</GenStep>
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
        <div className="flex w-full max-w-md flex-col items-center text-center">
          <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-honey-soft text-honey-text">
            <PartyPopper size={34} />
          </div>
          <h2 className="mt-6 font-brand text-[26px] font-semibold">Ваш сайт готовий!</h2>
          <p className="mt-2.5 text-[17px] text-ink-muted">Він уже працює за адресою:</p>

          <Card className="mt-5 flex w-full flex-col gap-3.5 p-5">
            <span className="break-all text-center text-[18px] font-extrabold text-brand">
              {displayUrl}
            </span>
            <div className="flex gap-2.5">
              <a
                href={siteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-[54px] flex-[1.3] items-center justify-center rounded-[16px] bg-brand text-[16px] font-bold text-white transition-colors hover:bg-brand-hover"
              >
                Відкрити сайт ↗
              </a>
              <button
                onClick={copyUrl}
                className="flex h-[54px] flex-1 items-center justify-center rounded-[16px] border-[1.5px] border-line-strong bg-surface text-[16px] font-bold text-ink transition-colors hover:bg-sunken"
              >
                {copied ? "Скопійовано ✓" : "Копіювати"}
              </button>
            </div>
          </Card>

          <p className="mt-3 text-[14px] text-ink-muted">
            Перегляньте сайт — фото й зображення можна замінити в редакторі.
          </p>

          <div className="mt-3.5 flex w-full items-center gap-3.5 rounded-[18px] border-[1.5px] border-line bg-surface px-5 py-4 text-left">
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
                className="flex h-[54px] w-full items-center justify-center rounded-[16px] border-[1.5px] border-line-strong bg-surface text-[16px] font-bold text-ink transition-colors hover:bg-sunken"
              >
                ✏️ Редагувати сайт
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
      <div className="flex w-full max-w-md flex-col items-center text-center">
        <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-danger-soft text-danger">
          <CircleAlert size={34} />
        </div>
        <h2 className="mt-6 font-brand text-[24px] font-semibold">Щось пішло не так</h2>
        <p className="mt-4 rounded-[14px] bg-danger-soft px-5 py-4 text-[15px] font-semibold leading-relaxed text-danger">
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

function ChatBubble({ msg }: { msg: ChatMsg }) {
  const isUser = msg.role === "user";
  const atts = msg.attachments ?? [];
  if (!msg.content && atts.length === 0) return null;
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] px-[18px] py-3.5 text-[17px] leading-relaxed sm:max-w-[75%] ${
          isUser
            ? "rounded-[20px_20px_6px_20px] bg-brand text-white"
            : "rounded-[20px_20px_20px_6px] border-[1.5px] border-line bg-surface text-ink shadow-[0_1px_2px_rgba(23,36,47,0.04)]"
        }`}
      >
        {atts.length > 0 && (
          <div className={`flex flex-wrap gap-1.5 ${msg.content ? "mb-2.5" : ""}`}>
            {atts.map((u, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={u} alt="" className="h-24 w-24 rounded-[12px] object-cover" />
            ))}
          </div>
        )}
        {msg.content !== "" && (
          <p className="whitespace-pre-wrap">{isUser ? msg.content : renderBold(msg.content)}</p>
        )}
      </div>
    </div>
  );
}

// Working indicator: dots + a label. While the model is in its extended-
// thinking phase we say so honestly («Думаю…» — real state from the stream,
// not a fake stage); before that a short "reading" label.
function AgentTyping({ thinking = false }: { thinking?: boolean }) {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-2.5 rounded-[20px_20px_20px_6px] border-[1.5px] border-line bg-surface px-[18px] py-4">
        <span className="flex items-center gap-1.5">
          {[0, 0.15, 0.3].map((d) => (
            <span
              key={d}
              className="h-2 w-2 rounded-full bg-ink-faint"
              style={{ animation: `ob-typing 1.2s infinite ${d}s` }}
            />
          ))}
        </span>
        <span className="text-[14px] font-semibold text-ink-muted">
          {thinking ? "Думаю, як допомогти найкраще…" : "Читаю відповідь…"}
        </span>
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
        <span aria-hidden>✓</span>
      ) : state === "active" ? (
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-[2.5px] border-brand border-t-transparent" aria-hidden />
      ) : (
        <span className="inline-block h-4 w-4 rounded-full border-2 border-line-strong" aria-hidden />
      )}
      <span>{children}</span>
    </div>
  );
}

function Confetti() {
  const pieces = [
    { left: "16%", color: "#E9A23B", w: 10, h: 14, delay: 0, dur: 2.6 },
    { left: "38%", color: "#1B5BBF", w: 8, h: 12, delay: 0.4, dur: 3.1 },
    { left: "58%", color: "#177E53", w: 10, h: 10, delay: 0.8, dur: 2.8, round: true },
    { left: "80%", color: "#E9A23B", w: 8, h: 13, delay: 1.2, dur: 3.4 },
    { left: "27%", color: "#C03A32", w: 9, h: 9, delay: 1.6, dur: 3, round: true },
    { left: "70%", color: "#1B5BBF", w: 9, h: 12, delay: 0.2, dur: 3.2 },
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
