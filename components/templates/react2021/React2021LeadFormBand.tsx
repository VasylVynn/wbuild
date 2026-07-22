"use client";

import { useState } from "react";
import type { BlockProps } from "@/lib/blocks/schema";

/*
 * Lead form · variant "band" — same form CONTRACT as the base React2021LeadForm
 * (identical name/phone/message fields, the "website" honeypot, the same
 * POST /api/leads + idle→sending→sent/error flow) restructured into a full-bleed
 * dark-ink (#1a2e35) band. The heading leads a left column; the fields sit in a
 * right column with name/phone paired on one inline row. Base is a single
 * centred card — this splits the axis, pairs the fields, and swaps to a band.
 */
export default function React2021LeadFormBand({ data }: { data: unknown }) {
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
    "w-full rounded-md border border-transparent bg-white px-4 py-3 text-sm text-[#1a2e35] placeholder-gray-400 transition-colors focus:border-[#ec4755] focus:outline-none focus:ring-1 focus:ring-[#ec4755]";

  return (
    <section className="bg-[#1a2e35] py-14 md:py-16" aria-labelledby="lead-form-title">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 id="lead-form-title" className="text-2xl font-extrabold text-white sm:text-3xl">
              {d.title ?? "Залишити заявку"}
            </h2>
            {d.subtitle && <p className="mt-3 text-gray-300">{d.subtitle}</p>}
          </div>

          <div>
            {state === "sent" ? (
              <p className="text-lg font-medium text-white">
                ✅ Дякуємо! Ми звʼяжемось з вами найближчим часом.
              </p>
            ) : (
              <form onSubmit={submit} className="flex flex-col gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
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
                </div>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Що вас цікавить? (необовʼязково)"
                  rows={2}
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
                  className="mt-1 w-full rounded-md bg-[#ec4755] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#a12c34] disabled:opacity-50 sm:w-auto sm:self-start sm:px-8"
                >
                  {state === "sending" ? "Надсилаємо…" : (d.buttonLabel ?? "Надіслати заявку")}
                </button>
                {state === "error" && (
                  <p className="text-sm text-gray-300">
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
