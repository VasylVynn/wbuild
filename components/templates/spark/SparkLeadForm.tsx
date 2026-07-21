"use client";

import { useState } from "react";
import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Lead form — the funnel. The FORM behaviour is copied VERBATIM from the other
 * templates (RestaurantLeadForm): POSTs { name, phone, message, website } to
 * /api/leads on the same tenant host, carries the "website" honeypot, and walks
 * idle → sending → sent/error. Only the styling is the clean spark system: a
 * hairline card, medium heading, token-bordered inputs with a ring focus, and a
 * solid primary submit. A simple name/phone/message form (no extra fields).
 */
export default function SparkLeadForm({ data }: { data: unknown }) {
  const d = data as BlockProps["lead_form"];
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

  const inputClass =
    "w-full rounded-[var(--spark-radius)] border border-[var(--spark-border)] bg-[var(--spark-bg)] px-4 py-3 text-sm text-[var(--spark-fg)] placeholder-[var(--spark-muted-fg)] transition-colors focus:border-[var(--spark-fg)] focus:outline-none focus:ring-2 focus:ring-[var(--spark-ring)]/40";

  return (
    <section id="lead_form" className="bg-[var(--spark-bg)] px-4 py-16 sm:px-6 md:py-24" aria-labelledby="spark-lead-title">
      <div className="mx-auto max-w-xl">
        <div className="spark-card p-8">
          <h2 id="spark-lead-title" className="text-2xl text-[var(--spark-fg)]">
            {d.title ?? "Залишити заявку"}
          </h2>
          {d.subtitle && <p className="mt-2 text-sm text-[var(--spark-muted-fg)]">{d.subtitle}</p>}

          {state === "sent" ? (
            <p className="mt-6 text-lg font-medium text-[var(--spark-fg)]">
              Дякуємо! Ми звʼяжемось з вами найближчим часом.
            </p>
          ) : (
            <form onSubmit={submit} className="mt-6 flex flex-col gap-3">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ваше імʼя"
                className={inputClass}
              />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Телефон"
                required
                className={inputClass}
              />
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Що вас цікавить? (необовʼязково)"
                rows={3}
                className={`${inputClass} resize-none`}
              />
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
              <button type="submit" disabled={state === "sending"} className="spark-btn spark-btn-primary mt-2 w-full disabled:opacity-50">
                {state === "sending" ? "Надсилаємо…" : (d.buttonLabel ?? "Надіслати заявку")}
              </button>
              {state === "error" && (
                <p className="text-sm text-[var(--spark-muted-fg)]">
                  Не вдалося надіслати. Спробуйте ще раз або зателефонуйте нам.
                </p>
              )}
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

/*
 * Variant "split" — the SAME form contract as the base (name/phone/message +
 * "website" honeypot → POST /api/leads, idle → sending → sent/error), only the
 * shell is restructured into a two-column split: a muted decor panel on the left
 * carries the mono eyebrow + heading + subtitle, the form sits on the right. No
 * field, endpoint or honeypot changes.
 */
export function SparkLeadFormSplit({ data }: { data: unknown }) {
  const d = data as BlockProps["lead_form"];
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

  const inputClass =
    "w-full rounded-[var(--spark-radius)] border border-[var(--spark-border)] bg-[var(--spark-bg)] px-4 py-3 text-sm text-[var(--spark-fg)] placeholder-[var(--spark-muted-fg)] transition-colors focus:border-[var(--spark-fg)] focus:outline-none focus:ring-2 focus:ring-[var(--spark-ring)]/40";

  return (
    <section id="lead_form" className="bg-[var(--spark-bg)] px-4 py-16 sm:px-6 md:py-24" aria-labelledby="spark-lead-split-title">
      <div className="mx-auto max-w-4xl">
        <div className="grid overflow-hidden rounded-[var(--spark-radius)] border border-[var(--spark-border)] md:grid-cols-2">
          <div className="flex flex-col justify-center bg-[var(--spark-muted)] p-8 md:p-10">
            <p className="spark-eyebrow mb-3">Звʼязок</p>
            <h2 id="spark-lead-split-title" className="text-2xl text-[var(--spark-fg)] md:text-3xl">
              {d.title ?? "Залишити заявку"}
            </h2>
            {d.subtitle && <p className="mt-3 text-sm leading-relaxed text-[var(--spark-muted-fg)]">{d.subtitle}</p>}
          </div>

          <div className="bg-[var(--spark-card)] p-8">
            {state === "sent" ? (
              <p className="text-lg font-medium text-[var(--spark-fg)]">
                Дякуємо! Ми звʼяжемось з вами найближчим часом.
              </p>
            ) : (
              <form onSubmit={submit} className="flex flex-col gap-3">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ваше імʼя"
                  className={inputClass}
                />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Телефон"
                  required
                  className={inputClass}
                />
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Що вас цікавить? (необовʼязково)"
                  rows={3}
                  className={`${inputClass} resize-none`}
                />
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
                <button type="submit" disabled={state === "sending"} className="spark-btn spark-btn-primary mt-2 w-full disabled:opacity-50">
                  {state === "sending" ? "Надсилаємо…" : (d.buttonLabel ?? "Надіслати заявку")}
                </button>
                {state === "error" && (
                  <p className="text-sm text-[var(--spark-muted-fg)]">
                    Не вдалося надіслати. Спробуйте ще раз або зателефонуйте нам.
                  </p>
                )}
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
