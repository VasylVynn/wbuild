"use client";

import { useState } from "react";
import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Lead form · variant "split" — same form CONTRACT as the base NextlyLeadForm
 * (identical name/phone/message fields, the "website" honeypot, the same
 * POST /api/leads + idle→sending→sent/error flow) restructured into a
 * two-column band: a left indigo decor panel holds the heading, subtitle and a
 * short process aside, the right panel holds the fields. Base is a single
 * centred card; this splits the axis and adds a decor panel. Light + dark.
 */
export default function NextlyLeadFormSplit({ data }: { data: unknown }) {
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
    "w-full rounded-md border border-gray-300 bg-white px-4 py-3 text-sm text-gray-800 placeholder-gray-400 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-gray-100 dark:placeholder-gray-500";

  const steps = [
    "Залиште імʼя та телефон — ми звʼяжемося з вами.",
    "Опишіть запит, щоб ми підготувались до розмови.",
  ];

  return (
    <section className="py-16 lg:py-20" aria-labelledby="lead-form-title">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="grid overflow-hidden rounded-2xl shadow-sm lg:grid-cols-2">
          {/* Left decor / info panel. */}
          <div className="flex flex-col justify-center bg-indigo-600 p-8 text-white sm:p-10 dark:bg-indigo-700">
            <h2 id="lead-form-title" className="text-2xl font-bold leading-snug">
              {d.title ?? "Залишити заявку"}
            </h2>
            {d.subtitle && <p className="mt-3 text-indigo-100">{d.subtitle}</p>}
            <ul className="mt-6 space-y-3">
              {steps.map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-indigo-100">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-indigo-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
                  </svg>
                  {step}
                </li>
              ))}
            </ul>
          </div>

          {/* Right form panel. */}
          <div className="bg-gray-50 p-8 sm:p-10 dark:bg-neutral-800">
            {state === "sent" ? (
              <p className="text-lg font-medium text-indigo-600 dark:text-indigo-400">
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
      </div>
    </section>
  );
}
