"use client";

import { useState } from "react";
import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Lead form — NO source equivalent. The FORM behaviour is copied verbatim
 * from components/templates/studio/LeadFormSection.tsx (itself ported from
 * components/blocks/LeadForm.tsx): POSTs { name, phone, message, website } to
 * /api/leads on the same tenant host, carries the "website" honeypot, and
 * walks the idle → sending → sent/error states. Only the styling is
 * re-skinned to the aisaas soft-pastel system: a rounded lavender card,
 * bold dark-teal heading, white rounded-2xl inputs with a coral focus ring,
 * and a full-width rounded-full coral submit button.
 */
export default function AiSaasLeadForm({ data }: { data: unknown }) {
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
    "w-full rounded-2xl bg-white border border-[#2F4550]/10 px-4 py-3 text-sm text-[#2F4550] placeholder-[#2F4550]/40 transition-colors focus:outline-none focus:border-[#E07A5F]";

  return (
    <section className="py-12 md:py-16" aria-labelledby="lead-form-title">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <div className="mx-auto max-w-xl rounded-3xl bg-[#F1F0FB] p-8">
          <h2 id="lead-form-title" className="text-2xl font-bold text-[#2F4550]">
            {d.title ?? "Залишити заявку"}
          </h2>
          {d.subtitle && <p className="mt-2 text-sm text-[#2F4550]/70">{d.subtitle}</p>}

          {state === "sent" ? (
            <p className="mt-6 text-lg font-medium text-[#E07A5F]">
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
                className="mt-2 w-full rounded-full bg-[#E07A5F] px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {state === "sending" ? "Надсилаємо…" : (d.buttonLabel ?? "Надіслати заявку")}
              </button>
              {state === "error" && (
                <p className="text-sm text-[#2F4550]/60">
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
