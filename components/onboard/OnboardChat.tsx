"use client";

import {
  useState,
  useRef,
  useEffect,
  type KeyboardEvent as ReactKeyboardEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import type { ChatMsg, ProgressItem } from "@/lib/ai/onboard";
import {
  onboardAction,
  finalizeAction,
  sessionStateAction,
} from "@/app/app/new/actions";
import {
  startConversation,
  saveTurn,
  saveMediaAction,
  loadConversation,
} from "@/app/app/new/persist-actions";
import type { BusinessFacts } from "@/lib/verticals/schema";
import type { SiteMedia } from "@/lib/media/media";
import { Button, Field, Input, Textarea, Chip, Card } from "@/components/ui";
import PhotoField from "@/components/editor/PhotoField";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Phase = "chat" | "media" | "confirm" | "gate" | "generating" | "done" | "error";

type ServiceRow = { name: string; price: string };

const GREETING: ChatMsg = {
  role: "assistant",
  content:
    "Вітаю! 👋 Я допоможу створити сайт для вашого бізнесу. Розкажіть трохи — що це за бізнес, у якому місті, і який телефон для звʼязку?",
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

export function OnboardChat() {
  // --- Chat phase state ---
  const [messages, setMessages] = useState<ChatMsg[]>([GREETING]);
  const [facts, setFacts] = useState<Partial<BusinessFacts>>({});
  const [ready, setReady] = useState(false);
  const [verticalId, setVerticalId] = useState<string | undefined>(undefined);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  // «✓ Записав: …» під останньою відповіддю — реальний diff прогресу за хід.
  const [savedNote, setSavedNote] = useState<string | null>(null);

  // --- Shared loading flag (blocks all inputs while a request is in flight) ---
  const [loading, setLoading] = useState(false);

  // --- Phase ---
  const [phase, setPhase] = useState<Phase>("chat");

  // --- Media (logo + photos) — optional step before confirm ---
  const [media, setMedia] = useState<SiteMedia>({ photos: [] });

  // --- Confirm form state ---
  const [businessName, setBusinessName] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [hours, setHours] = useState("");
  const [about, setAbout] = useState("");
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // --- Done / error state ---
  const [siteUrl, setSiteUrl] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [copied, setCopied] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Holds the persisted conversation id after first user send; null = not yet created
  const convIdRef = useRef<string | null>(null);

  // Progress chips — derived, always in sync with the collected facts.
  const progress = deriveProgress(facts);

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
      // Media survives the login-gate redirect (saved fire-and-forget) — restore
      // it so the media step shows what was already uploaded.
      setMedia(data.media ?? { photos: [] });
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Chat handlers
  // ---------------------------------------------------------------------------

  // Core send — used by the input row AND by quick-reply chips.
  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || loading) return;

    const userMsg: ChatMsg = { role: "user", content: text };
    const nextMessages = [...messages, userMsg];
    const progressBefore = new Set(
      deriveProgress(facts).filter((p) => p.done).map((p) => p.label),
    );
    setMessages(nextMessages);
    setInput("");
    setQuickReplies([]);
    setSavedNote(null);
    setLoading(true);
    setTyping(true);

    // Lazily create the DB row on the first user send (avoids empty rows)
    if (convIdRef.current === null) {
      const started = await startConversation();
      if (started) {
        convIdRef.current = started.conversationId;
        localStorage.setItem("vitryna_conv_id", started.conversationId);
      }
    }

    try {
      const result = await onboardAction(nextMessages, facts, verticalId);
      const assistantMsg: ChatMsg = { role: "assistant", content: result.message };
      const finalMessages = [...nextMessages, assistantMsg];
      setMessages(finalMessages);
      setFacts(result.facts);
      setReady(result.ready);
      setVerticalId(result.verticalId);
      setQuickReplies(result.quickReplies ?? []);

      // Agentic feedback: which facts the agent just recorded — a real diff of
      // the same progress model as the header chips, not decoration.
      const newly = deriveProgress(result.facts)
        .filter((p) => p.done && !progressBefore.has(p.label))
        .map((p) => p.label);
      setSavedNote(newly.length ? newly.join(", ") : null);

      // Persist turn fire-and-forget — never blocks the UI
      if (convIdRef.current) {
        void saveTurn(
          convIdRef.current,
          finalMessages,
          result.facts,
          result.verticalId,
          result.ready,
        );
      }
    } finally {
      setLoading(false);
      setTyping(false);
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

  // ---------------------------------------------------------------------------
  // Login gate (journal #43) — runs before showing the confirm form.
  // ---------------------------------------------------------------------------

  const enterConfirm = () => {
    setBusinessName(facts.businessName ?? "");
    setCity(facts.city ?? "");
    setPhone(facts.phone ?? "");
    setAddress(facts.address ?? "");
    setHours(facts.hours ?? "");
    setAbout(facts.about ?? "");
    setServices(
      (facts.services ?? []).map((s) => ({ name: s.name, price: s.price ?? "" })),
    );
    setFormErrors({});
    setPhase("confirm");
  };

  // Ready CTA → the optional media step (login gate comes AFTER it, on «Далі»).
  const handleReviewAndCreate = () => {
    if (loading) return;
    setPhase("media");
  };

  // ---------------------------------------------------------------------------
  // Media step (§4.8) — optional logo + up to 3 photos, saved fire-and-forget so
  // uploads survive the login-gate redirect. «Далі» and «Пропустити» share this.
  // ---------------------------------------------------------------------------

  // Persist to state AND to the conversation row (best-effort). Onboarding
  // uploads scope by conversationId; if there's no row yet (Supabase off) the
  // save is simply skipped.
  const persistMedia = (next: SiteMedia) => {
    setMedia(next);
    if (convIdRef.current) void saveMediaAction(convIdRef.current, next);
  };

  const setLogo = (url: string) => persistMedia({ ...media, logoUrl: url });
  const clearLogo = () => persistMedia({ ...media, logoUrl: undefined });
  const replacePhoto = (i: number, url: string) =>
    persistMedia({ ...media, photos: media.photos.map((p, idx) => (idx === i ? url : p)) });
  const removePhoto = (i: number) =>
    persistMedia({ ...media, photos: media.photos.filter((_, idx) => idx !== i) });
  const addPhoto = (url: string) => {
    if (media.photos.length >= 3) return;
    persistMedia({ ...media, photos: [...media.photos, url] });
  };

  const handleMediaNext = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const s = await sessionStateAction();
      // Auth on + not signed in → warm gate (save the site), not the form.
      if (s.authOn && !s.loggedIn) {
        setPhase("gate");
        return;
      }
      enterConfirm();
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Confirm form handlers
  // ---------------------------------------------------------------------------

  const validateForm = (): boolean => {
    const errs: Record<string, string> = {};
    if (!businessName.trim()) errs.businessName = "Введіть назву бізнесу";
    if (!city.trim()) errs.city = "Введіть місто";
    if (!phone.trim()) errs.phone = "Введіть номер телефону";
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmitForm = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const fullFacts: BusinessFacts = {
      businessName: businessName.trim(),
      city: city.trim(),
      phone: phone.trim(),
      ...(address.trim() && { address: address.trim() }),
      ...(hours.trim() && { hours: hours.trim() }),
      ...(about.trim() && { about: about.trim() }),
      ...(services.filter((s) => s.name.trim()).length > 0 && {
        services: services
          .filter((s) => s.name.trim())
          .map((s) => ({
            name: s.name.trim(),
            ...(s.price.trim() && { price: s.price.trim() }),
          })),
      }),
    };

    setLoading(true);
    setPhase("generating");

    try {
      const result = await finalizeAction(fullFacts, verticalId, media);
      if (result.ok) {
        setSiteUrl(result.url);
        setPhase("done");
        // Conversation is complete — clear localStorage so next visit starts fresh
        localStorage.removeItem("vitryna_conv_id");
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

  // --- Service list helpers ---
  const addService = () => setServices((prev) => [...prev, { name: "", price: "" }]);
  const removeService = (idx: number) =>
    setServices((prev) => prev.filter((_, i) => i !== idx));
  const updateService = (idx: number, field: "name" | "price", val: string) =>
    setServices((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: val } : s)));

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
      <div className={`flex h-[100dvh] flex-col ${rootBase}`}>
        <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />

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

            {typing && <AgentTyping />}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Footer: ready CTA + quick replies + input */}
        <footer className="mx-auto w-full max-w-2xl px-4 pb-5">
          {ready && (
            <button
              onClick={handleReviewAndCreate}
              disabled={loading}
              className="mb-3 flex min-h-[60px] w-full items-center justify-center rounded-[18px] bg-brand text-[18px] font-bold text-white shadow-[0_8px_24px_rgba(27,91,191,0.35)] transition-colors hover:bg-brand-hover disabled:opacity-50"
            >
              Переглянути й створити сайт →
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

          <div className="flex items-center gap-2.5">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              placeholder={ready ? "Або допишіть щось…" : "Написати…"}
              autoComplete="off"
              className="h-14 min-w-0 flex-1 rounded-full border-[1.5px] border-line-strong bg-surface px-5 text-[17px] text-ink placeholder:text-ink-faint transition-shadow focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-soft disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              aria-label="Надіслати"
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-45"
            >
              <SendArrow />
            </button>
          </div>
        </footer>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render — media step (§4.8): optional logo + photos before the confirm form
  // ---------------------------------------------------------------------------

  if (phase === "media") {
    const convId = convIdRef.current ?? undefined;
    return (
      <div className={`min-h-[100dvh] ${rootBase}`}>
        <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />
        <header className="border-b border-line bg-surface">
          <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-4 py-3.5">
            <button
              onClick={() => setPhase("chat")}
              aria-label="Назад до розмови"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[20px] font-bold text-ink-muted hover:bg-sunken"
            >
              ←
            </button>
            <span className="text-[18px] font-extrabold text-ink">Лого та фото</span>
          </div>
        </header>

        <div className="mx-auto w-full max-w-2xl px-4 py-6">
          <Card className="flex flex-col gap-6 p-5 sm:p-8">
            <div>
              <h2 className="font-brand text-[22px] font-semibold leading-tight text-ink">
                Додайте лого та фото — сайт одразу виглядатиме як ваш
              </h2>
              <p className="mt-2 text-[16px] leading-relaxed text-ink-muted">
                Це необовʼязково — можна пропустити і додати пізніше в редакторі.
              </p>
            </div>

            <div className="flex flex-col gap-2.5">
              <span className="text-[15px] font-bold text-ink">Лого або фото вивіски</span>
              <PhotoField
                value={media.logoUrl}
                conversationId={convId}
                onChange={setLogo}
                onClear={clearLogo}
              />
            </div>

            <div className="flex flex-col gap-2.5">
              <span className="text-[15px] font-bold text-ink">Фото: роботи, приміщення, товари</span>
              <div className="flex flex-wrap items-start gap-3">
                {media.photos.map((url, i) => (
                  <PhotoField
                    key={i}
                    value={url}
                    conversationId={convId}
                    onChange={(u) => replacePhoto(i, u)}
                    onClear={() => removePhoto(i)}
                  />
                ))}
                {media.photos.length < 3 && (
                  <PhotoField
                    key={`add-${media.photos.length}`}
                    conversationId={convId}
                    onChange={addPhoto}
                    onClear={() => {}}
                  />
                )}
              </div>
            </div>
          </Card>

          <div className="mt-6 flex flex-col gap-2">
            <Button
              size="lg"
              disabled={loading}
              onClick={() => void handleMediaNext()}
              className="min-h-[60px] w-full text-[19px] shadow-[0_8px_24px_rgba(27,91,191,0.3)]"
            >
              Далі →
            </Button>
            <Button
              variant="quiet"
              size="md"
              disabled={loading}
              onClick={() => void handleMediaNext()}
              className="w-full"
            >
              Пропустити
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render — confirm form (design C)
  // ---------------------------------------------------------------------------

  if (phase === "confirm") {
    const hasErrors = Object.keys(formErrors).length > 0;
    return (
      <div className={`min-h-[100dvh] ${rootBase}`}>
        <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />
        <header className="border-b border-line bg-surface">
          <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-4 py-3.5">
            <button
              onClick={() => setPhase("chat")}
              aria-label="Назад до розмови"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[20px] font-bold text-ink-muted hover:bg-sunken"
            >
              ←
            </button>
            <span className="text-[18px] font-extrabold text-ink">Перевірте дані</span>
          </div>
        </header>

        <div className="mx-auto w-full max-w-2xl px-4 py-6">
          {(media.logoUrl || media.photos.length > 0) && (
            <div className="mb-5 flex flex-wrap items-center gap-2.5">
              {media.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={media.logoUrl}
                  alt="Лого"
                  className="h-14 w-14 shrink-0 rounded-[12px] border border-line bg-surface object-contain"
                />
              )}
              {media.photos.map((url) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={url}
                  src={url}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-[12px] border border-line object-cover"
                />
              ))}
            </div>
          )}
          <p className="mb-5 text-[16px] leading-relaxed text-ink-muted">
            Я заповнив усе з нашої розмови. Відредагуйте будь-що і натисніть «Створити сайт».
          </p>

          <form onSubmit={handleSubmitForm} noValidate className="flex flex-col gap-5">
            {hasErrors && (
              <div className="flex items-start gap-2.5 rounded-[14px] bg-danger-soft px-4 py-3.5">
                <span className="text-[17px]">☝️</span>
                <span className="text-[15px] font-bold leading-snug text-danger">
                  Заповніть, будь ласка, обовʼязкові поля нижче — без них клієнти не зможуть звʼязатися.
                </span>
              </div>
            )}

            <Card className="flex flex-col gap-5 p-5 sm:p-8">
              <Field label="Назва бізнесу *" error={formErrors.businessName}>
                <Input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Назва вашого бізнесу"
                  error={!!formErrors.businessName}
                />
              </Field>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field label="Місто *" error={formErrors.city}>
                  <Input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Київ"
                    error={!!formErrors.city}
                  />
                </Field>
                <Field label="Телефон *" error={formErrors.phone}>
                  <Input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+380 50 123 45 67"
                    error={!!formErrors.phone}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field label="Адреса">
                  <Input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="вул. Хрещатик, 1"
                  />
                </Field>
                <Field label="Години роботи">
                  <Input
                    type="text"
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                    placeholder="Пн–Пт 9:00–19:00, Сб–Нд 10:00–17:00"
                  />
                </Field>
              </div>

              <Field label="Про бізнес">
                <Textarea
                  value={about}
                  onChange={(e) => setAbout(e.target.value)}
                  rows={4}
                  placeholder="Кілька слів про ваш бізнес…"
                />
              </Field>

              {/* Editable services list — width pattern is load-bearing:
                  name = min-w-0 flex-1, price = w-28 shrink-0 (a stray w-full
                  would win in compiled CSS and collapse the sibling). */}
              <div className="flex flex-col gap-2.5">
                <span className="text-[15px] font-bold text-ink">Послуги та ціни</span>
                {services.length > 0 && (
                  <div className="flex items-center gap-2 px-0.5">
                    <span className="min-w-0 flex-1 text-[13px] font-bold text-ink-faint">Назва послуги</span>
                    <span className="w-28 shrink-0 text-[13px] font-bold text-ink-faint">Ціна</span>
                    <span className="w-12 shrink-0" />
                  </div>
                )}
                {services.map((svc, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={svc.name}
                      onChange={(e) => updateService(idx, "name", e.target.value)}
                      placeholder="Назва послуги"
                      className={`${svcInput} min-w-0 flex-1`}
                    />
                    <input
                      type="text"
                      value={svc.price}
                      onChange={(e) => updateService(idx, "price", e.target.value)}
                      placeholder="Ціна"
                      className={`${svcInput} w-28 shrink-0`}
                    />
                    <button
                      type="button"
                      onClick={() => removeService(idx)}
                      aria-label="Видалити рядок"
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] text-[22px] text-ink-faint transition-colors hover:bg-danger-soft hover:text-danger"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addService}
                  className="flex min-h-[52px] items-center justify-center rounded-[14px] border-2 border-dashed border-line-strong text-[16px] font-bold text-brand transition-colors hover:border-brand hover:bg-brand-soft"
                >
                  + Додати послугу
                </button>
              </div>
            </Card>

            <Button
              type="submit"
              size="lg"
              disabled={loading}
              className="min-h-[60px] w-full text-[19px] shadow-[0_8px_24px_rgba(27,91,191,0.3)]"
            >
              Створити сайт
            </Button>
          </form>
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
          <div className="text-[64px] leading-none">🎉</div>
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
        <div className="text-[64px] leading-none">😕</div>
        <h2 className="mt-6 font-brand text-[24px] font-semibold">Щось пішло не так</h2>
        <p className="mt-4 rounded-[14px] bg-danger-soft px-5 py-4 text-[15px] font-semibold leading-relaxed text-danger">
          {errorMsg}
        </p>
        <Button size="lg" className="mt-6" onClick={() => setPhase("confirm")}>
          Спробувати ще раз
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small local sub-components + shared class strings
// ---------------------------------------------------------------------------

// Service-row input: mirrors the ui/Input look WITHOUT `w-full`, so the flex
// widths (min-w-0 flex-1 / w-28 shrink-0) survive in the compiled CSS.
const svcInput =
  "min-h-12 rounded-[14px] border border-line-strong bg-surface px-4 text-[16px] text-ink placeholder:text-ink-faint transition-shadow focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-soft";

// Markdown-lite for agent replies: only **bold** is supported (the prompt
// forbids everything else). Built as React nodes — no HTML injection surface.
function renderBold(text: string): ReactNode[] {
  return text
    .split(/\*\*([^*]+)\*\*/g)
    .map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part));
}

function ChatBubble({ msg }: { msg: ChatMsg }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <p
        className={`max-w-[85%] whitespace-pre-wrap px-[18px] py-3.5 text-[17px] leading-relaxed sm:max-w-[75%] ${
          isUser
            ? "rounded-[20px_20px_6px_20px] bg-brand text-white"
            : "rounded-[20px_20px_20px_6px] border-[1.5px] border-line bg-surface text-ink shadow-[0_1px_2px_rgba(23,36,47,0.04)]"
        }`}
      >
        {isUser ? msg.content : renderBold(msg.content)}
      </p>
    </div>
  );
}

// Staged working indicator: dots + a label that advances through the real
// stages of a turn (read → save → next step) and holds on the last one.
const AGENT_STAGES = ["Читаю відповідь…", "Оновлюю дані сайту…", "Готую наступний крок…"];

function AgentTyping() {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const t = setInterval(
      () => setStage((s) => Math.min(s + 1, AGENT_STAGES.length - 1)),
      1400,
    );
    return () => clearInterval(t);
  }, []);
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
        <span className="text-[14px] font-semibold text-ink-muted">{AGENT_STAGES[stage]}</span>
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
