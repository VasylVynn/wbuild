"use client";

import { useState } from "react";
import type { BlockProps } from "@/lib/blocks/schema";

/**
 * The lead form — the core of the value loop (§5.6): visitor fills it in, the
 * owner gets the lead in Telegram. The ONLY interactive block; posts to
 * /api/leads on the SAME tenant host (the API resolves the tenant from Host).
 * Includes a honeypot field ("website") against dumb bots.
 */
export default function LeadForm({ data }: { data: BlockProps["lead_form"] }) {
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

  const inputStyle: React.CSSProperties = {
    borderColor: "var(--color-muted)",
    borderRadius: "var(--radius)",
    color: "var(--color-foreground)",
    backgroundColor: "var(--color-background)",
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <div
        className="mx-auto max-w-xl rounded-2xl p-8 sm:p-10"
        style={{ backgroundColor: "var(--color-accent)", borderRadius: "var(--radius)" }}
      >
        <h2
          className="text-3xl font-bold"
          style={{ fontFamily: "var(--font-heading)", color: "var(--color-foreground)" }}
        >
          {data.title ?? "Залишити заявку"}
        </h2>
        {data.subtitle && (
          <p className="mt-2 text-lg" style={{ color: "var(--color-muted-foreground)" }}>
            {data.subtitle}
          </p>
        )}

        {state === "sent" ? (
          <p className="mt-8 text-xl font-medium" style={{ color: "var(--color-primary)" }}>
            ✅ Дякуємо! Ми звʼяжемось з вами найближчим часом.
          </p>
        ) : (
          <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ваше імʼя"
              className="w-full border px-5 py-4 text-lg focus:outline-none"
              style={inputStyle}
            />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Телефон"
              required
              className="w-full border px-5 py-4 text-lg focus:outline-none"
              style={inputStyle}
            />
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Що вас цікавить? (необовʼязково)"
              rows={3}
              className="w-full resize-none border px-5 py-4 text-lg focus:outline-none"
              style={inputStyle}
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
              className="mt-2 w-full px-6 py-4 text-lg font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{
                backgroundColor: "var(--color-primary)",
                color: "var(--color-primary-foreground)",
                borderRadius: "var(--radius)",
              }}
            >
              {state === "sending" ? "Надсилаємо…" : (data.buttonLabel ?? "Надіслати заявку")}
            </button>
            {state === "error" && (
              <p className="text-base" style={{ color: "var(--color-foreground)" }}>
                Не вдалося надіслати. Спробуйте ще раз або зателефонуйте нам.
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
