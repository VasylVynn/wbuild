"use client";

import { useState } from "react";
import type { BlockProps } from "@/lib/blocks/schema";
import { CheckIcon } from "./icons";

/*
 * Lead form — the ONLY block with a submit handler. Behaviour mirrors the
 * restaurant/aisaas contract VERBATIM: POSTs { name, phone, message, website }
 * to /api/leads on the same tenant host, carries the "website" honeypot, and
 * walks idle → sending → sent/error. A SIMPLE name/phone/message form (no
 * date/time booking fields). Only the styling is the beleza system: a two-up
 * layout with reassurance bullets on the left and a soft white card on the
 * right with rose-focus inputs and a rose submit button.
 */
type LeadData = BlockProps["lead_form"];

const REASSURANCE = ["Відповідаємо швидко", "Запис без передоплати", "Зручний час для вас"];

export default function BelezaLeadForm({ data }: { data: unknown }) {
  const d = data as LeadData;
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot — humans never see it

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state === "sending") return;
    if (!phone.trim() && !name.trim()) return;
    setState("sending");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, message, website }),
      });
      setState(res.ok ? "sent" : "error");
    } catch {
      setState("error");
    }
  };

  return (
    <section id="lead_form" className="beleza-section" aria-labelledby="beleza-lead-title">
      <div className="beleza-container grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <div className="flex flex-col">
          <h2 id="beleza-lead-title" className="beleza-kicker !max-w-none">
            <strong>{d.title ?? "Запишіться на візит"}</strong>{" "}
            {d.subtitle ?? "Залиште контакти — і ми звʼяжемося, щоб підібрати зручний час."}
          </h2>
          <ul className="mt-8 flex flex-col gap-3">
            {REASSURANCE.map((item) => (
              <li key={item} className="beleza-muted flex items-center gap-2.5 text-sm">
                <CheckIcon className="h-4 w-4 shrink-0 text-[color:var(--beleza-branding)]" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="beleza-card !p-6 md:!p-8">
          {state === "sent" ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <span className="beleza-chip !h-14 !w-14 !rounded-full">
                <CheckIcon className="h-7 w-7" />
              </span>
              <h3 className="beleza-ink text-lg font-semibold">Заявку отримано!</h3>
              <p className="beleza-muted max-w-xs text-sm leading-relaxed">Дякуємо! Ми звʼяжемося з вами найближчим часом.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-3">
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ваше імʼя" className="beleza-input" />
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Телефон" required className="beleza-input" />
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Що вас цікавить? (необовʼязково)" rows={3} className="beleza-input resize-none" />
              {/* Honeypot: hidden from humans, tempting for bots */}
              <input
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                style={{ position: "absolute", left: "-9999px", height: 0, width: 0, opacity: 0 }}
              />
              <button type="submit" disabled={state === "sending"} className="beleza-btn beleza-btn--block mt-2 disabled:opacity-50">
                {state === "sending" ? "Надсилаємо…" : (d.buttonLabel ?? "Надіслати заявку")}
              </button>
              {state === "error" && (
                <p className="beleza-muted text-sm">Не вдалося надіслати. Спробуйте ще раз або зателефонуйте нам.</p>
              )}
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

/*
 * `inline` variant — the SAME funnel contract (name/phone/message + website
 * honeypot, POST /api/leads), only the SHELL changes: a single-column,
 * centred rose-tinted band with the primary fields laid out as one horizontal
 * row (name · phone · submit) and the message below. Distinct from the base
 * two-up split: one column instead of two, an inline field row instead of a
 * stacked card, and centred instead of left-aligned. No bullets rail.
 */
export function BelezaLeadFormInline({ data }: { data: unknown }) {
  const d = data as LeadData;
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot — humans never see it

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state === "sending") return;
    if (!phone.trim() && !name.trim()) return;
    setState("sending");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, message, website }),
      });
      setState(res.ok ? "sent" : "error");
    } catch {
      setState("error");
    }
  };

  return (
    <section id="lead_form" className="beleza-section beleza-tint" aria-labelledby="beleza-lead-title">
      <div className="beleza-container max-w-3xl text-center">
        <h2 id="beleza-lead-title" className="beleza-ink text-2xl font-bold sm:text-3xl">
          {d.title ?? "Запишіться на візит"}
        </h2>
        <p className="beleza-muted mx-auto mt-3 max-w-xl text-sm sm:text-base">
          {d.subtitle ?? "Залиште контакти — і ми звʼяжемося, щоб підібрати зручний час."}
        </p>

        {state === "sent" ? (
          <div className="mx-auto mt-8 flex max-w-md flex-col items-center gap-3">
            <span className="beleza-chip !h-14 !w-14 !rounded-full">
              <CheckIcon className="h-7 w-7" />
            </span>
            <h3 className="beleza-ink text-lg font-semibold">Заявку отримано!</h3>
            <p className="beleza-muted text-sm leading-relaxed">Дякуємо! Ми звʼяжемося з вами найближчим часом.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="mx-auto mt-8 flex max-w-2xl flex-col gap-3 text-left">
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ваше імʼя" className="beleza-input" />
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Телефон" required className="beleza-input" />
              <button type="submit" disabled={state === "sending"} className="beleza-btn disabled:opacity-50">
                {state === "sending" ? "Надсилаємо…" : (d.buttonLabel ?? "Надіслати заявку")}
              </button>
            </div>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Що вас цікавить? (необовʼязково)" rows={2} className="beleza-input resize-none" />
            {/* Honeypot: hidden from humans, tempting for bots */}
            <input
              type="text"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              style={{ position: "absolute", left: "-9999px", height: 0, width: 0, opacity: 0 }}
            />
            {state === "error" && (
              <p className="beleza-muted text-sm">Не вдалося надіслати. Спробуйте ще раз або зателефонуйте нам.</p>
            )}
          </form>
        )}
      </div>
    </section>
  );
}
