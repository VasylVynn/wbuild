"use client";

import { useState } from "react";
import type { BlockProps } from "@/lib/blocks/schema";
import { Reveal } from "./Reveal";

/*
 * Lead form — `split` variant. Identical form CONTRACT to FerriLeadForm: POSTs
 * { name, phone, message, website } to /api/leads on the tenant host, carries
 * the "website" honeypot, walks idle → sending → sent/error. Only the SHELL
 * changes: a single centred card becomes a two-column split where an editorial
 * heading column (gold label, serif title, gold rule, subtitle) sits BESIDE the
 * form instead of above it. Column axis, element order and alignment all differ.
 */
export default function FerriLeadFormSplit({ data }: { data: unknown }) {
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
    "w-full border border-gold-500/15 bg-navy-900/50 px-4 py-3 text-cream-100 placeholder-txt-muted transition-colors focus:border-gold-500 focus:outline-none";

  return (
    <section className="border-t border-gold-500/8 py-14 sm:py-20 lg:py-24" aria-labelledby="lead-form-title">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <Reveal className="grid gap-10 md:grid-cols-2 md:items-center md:gap-16">
          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-[3px] text-gold-500">Звʼязатися</p>
            <h2
              id="lead-form-title"
              className="font-[family-name:var(--ferri-display)] text-3xl font-normal text-cream-100 sm:text-4xl"
            >
              {d.title ?? "Залишити заявку"}
            </h2>
            <div className="mt-4 h-px w-12 bg-gold-500/40" />
            {d.subtitle && <p className="mt-6 max-w-md text-base leading-relaxed text-txt-muted">{d.subtitle}</p>}
          </div>

          <div>
            {state === "sent" ? (
              <p className="text-base font-medium text-gold-500">
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
                <button
                  type="submit"
                  disabled={state === "sending"}
                  className="mt-2 w-full bg-gold-500 px-6 py-3 text-[13px] font-medium uppercase tracking-[2px] text-navy-950 transition-all duration-300 hover:bg-gold-400 disabled:opacity-50"
                >
                  {state === "sending" ? "Надсилаємо…" : (d.buttonLabel ?? "Надіслати заявку")}
                </button>
                {state === "error" && (
                  <p className="text-sm text-txt-muted">
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
