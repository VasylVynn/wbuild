"use client";

import { useState } from "react";
import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Lead form — NO source equivalent (nextly has no lead-capture section). The
 * FORM behaviour is copied verbatim from components/templates/aisaas/AiSaasLeadForm.tsx
 * (itself ported from components/blocks/LeadForm.tsx): POSTs { name, phone,
 * message, website } to /api/leads on the same tenant host, carries the
 * "website" honeypot, and walks the idle → sending → sent/error states. Only
 * the styling is re-skinned to the nextly clean-indigo system: a light
 * gray-50 card, bold gray-800 heading, white rounded-md inputs with an
 * indigo focus ring, and a solid indigo submit button.
 */
export default function NextlyLeadForm({ data }: { data: unknown }) {
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
    "w-full rounded-md border border-gray-300 bg-white px-4 py-3 text-sm text-gray-800 placeholder-gray-400 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-gray-100 dark:placeholder-gray-500";

  return (
    <section className="py-16 lg:py-20" aria-labelledby="lead-form-title">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <div className="mx-auto max-w-xl rounded-2xl bg-gray-50 p-8 dark:bg-neutral-800">
          <h2 id="lead-form-title" className="text-2xl font-bold text-gray-800 dark:text-white">
            {d.title ?? "Залишити заявку"}
          </h2>
          {d.subtitle && <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{d.subtitle}</p>}

          {state === "sent" ? (
            <p className="mt-6 text-lg font-medium text-indigo-600 dark:text-indigo-400">
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
                className="mt-2 w-full rounded-md bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
              >
                {state === "sending" ? "Надсилаємо…" : (d.buttonLabel ?? "Надіслати заявку")}
              </button>
              {state === "error" && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
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
