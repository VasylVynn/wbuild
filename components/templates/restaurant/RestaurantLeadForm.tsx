"use client";

import { useState } from "react";
import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Lead form — ported from components/templates/aisaas/AiSaasLeadForm.tsx. The
 * FORM behaviour is copied VERBATIM (same source chain: studio/LeadFormSection →
 * blocks/LeadForm): POSTs { name, phone, message, website } to /api/leads on the
 * same tenant host, carries the "website" honeypot, and walks the idle → sending
 * → sent/error states. A SIMPLE name/phone/message form — no date/time/party-size
 * fields. Only the styling is re-skinned to the warm hospitality system: a sand
 * card, serif ink heading, white rounded-xl inputs with a terracotta focus ring,
 * and a full-width rounded-full terracotta submit button.
 */
export default function RestaurantLeadForm({ data }: { data: unknown }) {
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
    "w-full rounded-xl border border-[#E0D3C0] bg-white px-4 py-3 text-sm text-[#2A2018] placeholder-[#6F6257]/50 transition-colors focus:border-[#C0562F] focus:outline-none focus:ring-2 focus:ring-[#C0562F]/30";

  return (
    <section className="bg-[#FBF6EF] py-12 md:py-16" aria-labelledby="lead-form-title">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <div className="mx-auto max-w-xl rounded-3xl bg-[#F3EADD] p-8">
          <h2 id="lead-form-title" className="text-2xl font-bold text-[#2A2018]">
            {d.title ?? "Залишити заявку"}
          </h2>
          {d.subtitle && <p className="mt-2 text-sm text-[#6F6257]">{d.subtitle}</p>}

          {state === "sent" ? (
            <p className="mt-6 text-lg font-medium text-[#5F6F3E]">
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
                className="mt-2 w-full rounded-full bg-[#C0562F] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#9E4423] disabled:opacity-50"
              >
                {state === "sending" ? "Надсилаємо…" : (d.buttonLabel ?? "Надіслати заявку")}
              </button>
              {state === "error" && (
                <p className="text-sm text-[#6F6257]">
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
 * "website" honeypot → POST /api/leads on the tenant host, idle → sending →
 * sent/error), only the shell is restructured into a two-column split: a warm
 * terracotta decor panel on the left carries the heading + subtitle, the form
 * sits on the right. No field, endpoint or honeypot changes.
 */
export function RestaurantLeadFormSplit({ data }: { data: unknown }) {
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
    "w-full rounded-xl border border-[#E0D3C0] bg-white px-4 py-3 text-sm text-[#2A2018] placeholder-[#6F6257]/50 transition-colors focus:border-[#C0562F] focus:outline-none focus:ring-2 focus:ring-[#C0562F]/30";

  return (
    <section className="bg-[#FBF6EF] py-12 md:py-16" aria-labelledby="lead-form-split-title">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <div className="grid overflow-hidden rounded-3xl bg-[#F3EADD] md:grid-cols-2">
          <div className="flex flex-col justify-center bg-[#C0562F] p-8 text-white md:p-10">
            <h2 id="lead-form-split-title" className="font-serif text-2xl font-bold md:text-3xl">
              {d.title ?? "Залишити заявку"}
            </h2>
            {d.subtitle && <p className="mt-3 text-sm leading-relaxed text-white/85">{d.subtitle}</p>}
          </div>

          <div className="p-8 md:p-10">
            {state === "sent" ? (
              <p className="text-lg font-medium text-[#5F6F3E]">
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
                  className="mt-2 w-full rounded-full bg-[#C0562F] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#9E4423] disabled:opacity-50"
                >
                  {state === "sending" ? "Надсилаємо…" : (d.buttonLabel ?? "Надіслати заявку")}
                </button>
                {state === "error" && (
                  <p className="text-sm text-[#6F6257]">
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
