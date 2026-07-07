"use client";

import { useState, useRef, useEffect } from "react";
import type { ChatMsg } from "@/lib/ai/onboard";
import { onboardAction, finalizeAction } from "@/app/app/new/actions";
import {
  startConversation,
  saveTurn,
  loadConversation,
} from "@/app/app/new/persist-actions";
import type { FloristFacts } from "@/lib/verticals/florist";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Phase = "chat" | "confirm" | "generating" | "done" | "error";

type ServiceRow = { name: string; price: string };

const GREETING: ChatMsg = {
  role: "assistant",
  content:
    "Вітаю! 👋 Я допоможу створити сайт для вашого бізнесу. Розкажіть трохи — що це за бізнес, у якому місті, і який телефон для звʼязку?",
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function OnboardChat() {
  // --- Chat phase state ---
  const [messages, setMessages] = useState<ChatMsg[]>([GREETING]);
  const [facts, setFacts] = useState<Partial<FloristFacts>>({});
  const [ready, setReady] = useState(false);
  const [verticalId, setVerticalId] = useState<string | undefined>(undefined);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);

  // --- Shared loading flag (blocks all inputs while a request is in flight) ---
  const [loading, setLoading] = useState(false);

  // --- Phase ---
  const [phase, setPhase] = useState<Phase>("chat");

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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Holds the persisted conversation id after first user send; null = not yet created
  const convIdRef = useRef<string | null>(null);

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
      setFacts(data.facts as Partial<FloristFacts>);
      setVerticalId(data.verticalId);
      setReady(data.ready);
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Chat handlers
  // ---------------------------------------------------------------------------

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMsg = { role: "user", content: text };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ---------------------------------------------------------------------------
  // Confirm form handlers
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

  const validateForm = (): boolean => {
    const errs: Record<string, string> = {};
    if (!businessName.trim()) errs.businessName = "Введіть назву магазину";
    if (!city.trim()) errs.city = "Введіть місто";
    if (!phone.trim()) errs.phone = "Введіть номер телефону";
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const fullFacts: FloristFacts = {
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
      const result = await finalizeAction(fullFacts, verticalId);
      if (result.ok) {
        setSiteUrl(result.url);
        setPhase("done");
        // Conversation is complete — clear localStorage so next visit starts fresh
        localStorage.removeItem("vitryna_conv_id");
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

  // ---------------------------------------------------------------------------
  // Render — full-screen loading / done / error phases
  // ---------------------------------------------------------------------------

  if (phase === "generating") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 flex flex-col items-center gap-6 text-center">
        <div className="text-6xl" style={{ animation: "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite" }}>
          ✨
        </div>
        <h2 className="text-2xl font-semibold text-neutral-800">Генеруємо ваш сайт…</h2>
        <p className="text-neutral-500 text-lg">Це може зайняти до 30 секунд</p>
        <div className="flex gap-2 mt-2">
          <span className="w-3 h-3 rounded-full bg-neutral-400 animate-bounce [animation-delay:0ms]" />
          <span className="w-3 h-3 rounded-full bg-neutral-400 animate-bounce [animation-delay:150ms]" />
          <span className="w-3 h-3 rounded-full bg-neutral-400 animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 flex flex-col items-center gap-6 text-center">
        <div className="text-6xl">🎉</div>
        <h2 className="text-2xl font-semibold text-neutral-800">Ваш сайт готовий!</h2>
        <p className="text-neutral-500 text-lg">Перейдіть за посиланням, щоб побачити результат:</p>
        <a
          href={siteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xl font-medium text-blue-600 underline underline-offset-4 break-all hover:text-blue-800 transition-colors"
        >
          {siteUrl}
        </a>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 flex flex-col items-center gap-6 text-center">
        <div className="text-6xl">😕</div>
        <h2 className="text-2xl font-semibold text-neutral-800">Щось пішло не так</h2>
        <p className="text-red-500 text-base bg-red-50 rounded-2xl px-5 py-4 max-w-lg">
          {errorMsg}
        </p>
        <button
          onClick={() => setPhase("confirm")}
          className="mt-2 px-8 py-4 rounded-2xl bg-neutral-800 text-white text-lg font-medium hover:bg-neutral-700 active:scale-95 transition-all"
        >
          Спробувати ще раз
        </button>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render — confirm form
  // ---------------------------------------------------------------------------

  if (phase === "confirm") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-semibold text-neutral-800 mb-1">Перевірте дані</h2>
        <p className="text-neutral-500 mb-8 text-base">
          Відредагуйте будь-що і натисніть «Створити сайт».
        </p>

        <form onSubmit={handleSubmitForm} noValidate className="flex flex-col gap-5">
          <FormField label="Назва магазину *" error={formErrors.businessName}>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Назва вашого бізнесу"
              className={inputCls(!!formErrors.businessName)}
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <FormField label="Місто *" error={formErrors.city}>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Київ"
                className={inputCls(!!formErrors.city)}
              />
            </FormField>
            <FormField label="Телефон *" error={formErrors.phone}>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+380 50 123 45 67"
                className={inputCls(!!formErrors.phone)}
              />
            </FormField>
          </div>

          <FormField label="Адреса">
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="вул. Хрещатик, 1"
              className={inputCls(false)}
            />
          </FormField>

          <FormField label="Години роботи">
            <input
              type="text"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="Пн–Пт 9:00–19:00, Сб–Нд 10:00–17:00"
              className={inputCls(false)}
            />
          </FormField>

          <FormField label="Про нас">
            <textarea
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              rows={4}
              placeholder="Кілька слів про ваш магазин…"
              className={`${inputCls(false)} resize-none`}
            />
          </FormField>

          {/* Editable services list */}
          <div>
            <p className="text-sm font-medium text-neutral-700 mb-3">Послуги та ціни</p>
            <div className="flex flex-col gap-3">
              {services.map((svc, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                  <input
                    type="text"
                    value={svc.name}
                    onChange={(e) => updateService(idx, "name", e.target.value)}
                    placeholder="Назва послуги"
                    className={`${inputCls(false)} flex-1`}
                  />
                  <input
                    type="text"
                    value={svc.price}
                    onChange={(e) => updateService(idx, "price", e.target.value)}
                    placeholder="Ціна"
                    className={`${inputCls(false)} w-28 shrink-0`}
                  />
                  <button
                    type="button"
                    onClick={() => removeService(idx)}
                    aria-label="Видалити рядок"
                    className="h-14 w-14 shrink-0 flex items-center justify-center rounded-2xl text-xl text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 transition-colors"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addService}
              className="mt-3 text-sm text-neutral-500 hover:text-neutral-700 underline underline-offset-2 transition-colors"
            >
              + Додати послугу
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-4 w-full py-5 rounded-2xl bg-neutral-800 text-white text-xl font-semibold hover:bg-neutral-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Створити сайт
          </button>
        </form>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render — chat phase
  // ---------------------------------------------------------------------------

  return (
    <div className="max-w-2xl mx-auto flex flex-col h-[80vh] px-4">
      {/* Message bubbles */}
      <div className="flex-1 overflow-y-auto py-6 flex flex-col gap-4">
        {messages.map((msg, i) => (
          <ChatBubble key={i} msg={msg} />
        ))}

        {/* Typing indicator */}
        {typing && (
          <div className="flex justify-start">
            <div className="bg-neutral-100 rounded-3xl rounded-bl-md px-5 py-4">
              <span className="flex gap-1.5 items-center h-5">
                <span
                  className="w-2.5 h-2.5 rounded-full bg-neutral-400 animate-bounce"
                  style={{ animationDelay: "0ms" }}
                />
                <span
                  className="w-2.5 h-2.5 rounded-full bg-neutral-400 animate-bounce"
                  style={{ animationDelay: "150ms" }}
                />
                <span
                  className="w-2.5 h-2.5 rounded-full bg-neutral-400 animate-bounce"
                  style={{ animationDelay: "300ms" }}
                />
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* "Ready" CTA — appears above input once the assistant signals readiness */}
      {ready && (
        <div className="pb-3">
          <button
            onClick={enterConfirm}
            className="w-full py-4 rounded-2xl bg-neutral-800 text-white text-lg font-semibold hover:bg-neutral-700 active:scale-95 transition-all"
          >
            Переглянути й створити сайт →
          </button>
        </div>
      )}

      {/* Input row */}
      <div className="py-3 flex gap-3 items-end border-t border-neutral-100">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          placeholder="Написати…"
          autoComplete="off"
          className="flex-1 min-h-14 px-5 py-4 rounded-2xl border border-neutral-200 bg-white text-neutral-900 text-base placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-300 disabled:opacity-50 transition-shadow"
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="h-14 px-6 rounded-2xl bg-neutral-800 text-white text-base font-medium hover:bg-neutral-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all whitespace-nowrap"
        >
          Надіслати
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small local sub-components
// ---------------------------------------------------------------------------

function ChatBubble({ msg }: { msg: ChatMsg }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <p
        className={`max-w-[82%] px-5 py-4 rounded-3xl text-base leading-relaxed whitespace-pre-wrap ${
          isUser
            ? "bg-neutral-800 text-white rounded-br-md"
            : "bg-neutral-100 text-neutral-800 rounded-bl-md"
        }`}
      >
        {msg.content}
      </p>
    </div>
  );
}

function FormField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-neutral-700">{label}</span>
      {children}
      {error && <span className="text-sm text-red-500">{error}</span>}
    </label>
  );
}

function inputCls(hasError: boolean): string {
  return [
    "w-full min-h-14 px-5 py-4 rounded-2xl border text-base text-neutral-900",
    "placeholder:text-neutral-400 focus:outline-none focus:ring-2 transition-shadow",
    hasError
      ? "border-red-300 bg-red-50 focus:ring-red-200"
      : "border-neutral-200 bg-white focus:ring-neutral-300",
  ].join(" ");
}
