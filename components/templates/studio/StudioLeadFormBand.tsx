"use client";

import { useState } from "react";
import type { BlockProps } from "@/lib/blocks/schema";
import { Reveal } from "../shared/reveal";

/*
 * Lead form — `band` variant. Identical form CONTRACT to LeadFormSection:
 * POSTs { name, phone, message, website } to /api/leads on the tenant host,
 * carries the "website" honeypot, walks idle → sending → sent/error. Only the
 * SHELL changes: a narrow centred card becomes a full-width accent band whose
 * fields sit inline in a row (name + phone side by side, message spanning,
 * submit inline). Density paradigm and field axis both differ from the base.
 */
export default function StudioLeadFormBand({ data }: { data: unknown }) {
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
    "w-full rounded-md bg-white/[0.03] border border-[var(--color-border)] px-4 py-3 text-sm text-white placeholder-zinc-500 transition-colors focus:outline-none focus:border-[var(--color-accent)]";

  return (
    <section className="py-12 md:py-16" aria-labelledby="lead-form-title">
      <div className="container mx-auto px-4 sm:px-6">
        <Reveal margin="-80px" className="card gradient-border relative mx-auto max-w-6xl overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{ background: "radial-gradient(ellipse at 15% 0%, rgba(139,92,246,0.2), transparent 55%)" }}
          />
          <div className="relative grid gap-8 md:grid-cols-[0.9fr_1.1fr] md:items-center">
            <div>
              <h2 id="lead-form-title" className="section-title mb-2">
                {d.title ?? "Залишити заявку"}
              </h2>
              {d.subtitle && <p className="text-sm text-zinc-400">{d.subtitle}</p>}
            </div>

            {state === "sent" ? (
              <p className="text-lg font-medium text-[var(--color-accent)]">
                ✅ Дякуємо! Ми звʼяжемось з вами найближчим часом.
              </p>
            ) : (
              <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
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
                  rows={2}
                  className={`${inputClass} resize-none sm:col-span-2`}
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
                  className="btn-gradient w-full disabled:opacity-50 sm:col-span-2"
                >
                  {state === "sending" ? "Надсилаємо…" : (d.buttonLabel ?? "Надіслати заявку")}
                </button>
                {state === "error" && (
                  <p className="text-sm text-zinc-400 sm:col-span-2">
                    Не вдалося надіслати. Спробуйте ще раз або зателефонуйте нам.
                  </p>
                )}
              </form>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
