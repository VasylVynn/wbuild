"use client";

import { useState } from "react";
import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Lead form — the funnel. FORM behaviour is copied VERBATIM from the other
 * templates' lead forms: POSTs { name, phone, message, website } to /api/leads
 * on the same tenant host, carries the "website" honeypot, and walks the
 * idle → sending → sent/error states. A simple name/phone/message form. Only the
 * styling is re-skinned to the Launch look: a glass card over a glow, brand
 * focus ring, primary submit. §7 invariant: /api/leads resolves the tenant from
 * the Host header, not the body.
 */
export default function LaunchLeadForm({ data }: { data: unknown }) {
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
    "w-full rounded-xl border border-[var(--launch-border)] bg-[var(--launch-input)] px-4 py-3 text-sm text-[var(--launch-fg)] placeholder-[var(--launch-muted)] transition-colors focus:border-[var(--launch-brand)] focus:outline-none focus:ring-2 focus:ring-[var(--launch-brand)]/40";

  return (
    <section className="relative overflow-hidden px-4 py-20 sm:px-6 md:py-24" aria-labelledby="lead-form-title">
      <div className="launch-glow launch-glow--center" aria-hidden="true" />
      <div className="relative z-10 mx-auto max-w-xl">
        <div className="launch-glass rounded-3xl p-8 sm:p-10">
          <h2 id="lead-form-title" className="text-2xl font-bold text-[var(--launch-fg)] sm:text-3xl">
            {d.title ?? "Залишити заявку"}
          </h2>
          {d.subtitle && <p className="mt-2 text-sm text-[var(--launch-muted)]">{d.subtitle}</p>}

          {state === "sent" ? (
            <p className="mt-6 text-lg font-medium text-[var(--launch-brand)]">
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
                className="launch-btn launch-btn--primary mt-2 w-full disabled:opacity-50"
              >
                {state === "sending" ? "Надсилаємо…" : (d.buttonLabel ?? "Надіслати заявку")}
              </button>
              {state === "error" && (
                <p className="text-sm text-[var(--launch-muted)]">
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
