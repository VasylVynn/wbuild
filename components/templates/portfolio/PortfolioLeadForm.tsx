"use client";

import { useState } from "react";
import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Lead form — NO source equivalent. The FORM behaviour is copied verbatim from
 * components/blocks/LeadForm.tsx (via components/templates/studio/LeadFormSection.tsx):
 * it POSTs { name, phone, message, website } to /api/leads on the same tenant
 * host, carries the "website" honeypot, and walks the idle → sending →
 * sent/error states. Only the styling is re-skinned to the portfolio's
 * dark-teal glass system: a glowing glass card, teal-focus inputs, and a
 * pill submit button.
 */
export default function PortfolioLeadForm({ data }: { data: unknown }) {
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
    "w-full rounded-xl bg-surface/50 border border-border px-4 py-3 text-sm text-foreground placeholder-muted-foreground transition-colors focus:outline-none focus:border-primary";

  return (
    <section className="py-16 md:py-24" aria-labelledby="lead-form-title">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="glass rounded-3xl p-8 max-w-xl mx-auto animate-fade-in">
          <h2 id="lead-form-title" className="text-2xl md:text-3xl font-semibold glow-text">
            {d.title ?? "Залишити заявку"}
          </h2>
          {d.subtitle && <p className="text-muted-foreground text-sm mt-2">{d.subtitle}</p>}

          {state === "sent" ? (
            <p className="mt-6 text-lg font-medium text-primary">
              ✅ Дякуємо! Ми звʼяжемось з вами найближчим часом.
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
              <button
                type="submit"
                disabled={state === "sending"}
                className="mt-2 w-full rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 px-6 py-3 text-sm font-medium transition-opacity disabled:opacity-50"
              >
                {state === "sending" ? "Надсилаємо…" : (d.buttonLabel ?? "Надіслати заявку")}
              </button>
              {state === "error" && (
                <p className="text-sm text-muted-foreground">
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
 * shell is restructured into a two-column split: a glowing glass decor panel on
 * the left carries the heading + subtitle, the form sits in a glass card on the
 * right. No field, endpoint or honeypot changes.
 */
export function PortfolioLeadFormSplit({ data }: { data: unknown }) {
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
    "w-full rounded-xl bg-surface/50 border border-border px-4 py-3 text-sm text-foreground placeholder-muted-foreground transition-colors focus:outline-none focus:border-primary";

  return (
    <section className="py-16 md:py-24" aria-labelledby="lead-form-split-title">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="mx-auto grid max-w-4xl items-stretch gap-6 lg:grid-cols-2">
          <div className="glass glow-border animate-fade-in flex flex-col justify-center rounded-3xl p-8 md:p-10">
            <h2 id="lead-form-split-title" className="text-2xl md:text-3xl font-semibold glow-text text-foreground">
              {d.title ?? "Залишити заявку"}
            </h2>
            {d.subtitle && <p className="text-muted-foreground text-sm mt-3 leading-relaxed">{d.subtitle}</p>}
          </div>

          <div className="glass animate-fade-in rounded-3xl p-8">
            {state === "sent" ? (
              <p className="text-lg font-medium text-primary">
                ✅ Дякуємо! Ми звʼяжемось з вами найближчим часом.
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
                <button
                  type="submit"
                  disabled={state === "sending"}
                  className="mt-2 w-full rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 px-6 py-3 text-sm font-medium transition-opacity disabled:opacity-50"
                >
                  {state === "sending" ? "Надсилаємо…" : (d.buttonLabel ?? "Надіслати заявку")}
                </button>
                {state === "error" && (
                  <p className="text-sm text-muted-foreground">
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
