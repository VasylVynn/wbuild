"use client";

import { useState } from "react";
import type { BlockProps } from "@/lib/blocks/schema";

/**
 * The interactive half of the wireframe lead form — the ONLY client component
 * in salonwire. Mirrors components/blocks/LeadForm.tsx: posts to /api/leads on
 * the SAME tenant host (the API resolves the tenant from the Host header) and
 * carries the "website" honeypot. Styling stays within the wire-* class
 * contract: structure here, surface in the generated stylesheet.
 */
export default function WireLeadFormClient({ data }: { data: BlockProps["lead_form"] }) {
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

  if (state === "sent") {
    return (
      <p className="wire-heading wire-leadform__done">
        Дякуємо! Ми звʼяжемось з вами найближчим часом.
      </p>
    );
  }

  return (
    <form className="wire-stack wire-leadform__form" onSubmit={submit}>
      <div className="wire-field">
        <label className="wire-eyebrow" htmlFor="wire-name">
          Імʼя
        </label>
        <input
          className="wire-input"
          id="wire-name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
        />
      </div>
      <div className="wire-field">
        <label className="wire-eyebrow" htmlFor="wire-phone">
          Телефон
        </label>
        <input
          className="wire-input"
          id="wire-phone"
          name="phone"
          type="tel"
          inputMode="tel"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          autoComplete="tel"
        />
      </div>
      <div className="wire-field">
        <label className="wire-eyebrow" htmlFor="wire-msg">
          Повідомлення
        </label>
        <textarea
          className="wire-textarea"
          id="wire-msg"
          name="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </div>
      {/* Honeypot: hidden from humans, tempting for bots */}
      <input
        className="wire-leadform__hp"
        type="text"
        name="website"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />
      <button className="wire-btn wire-btn--primary" type="submit" disabled={state === "sending"}>
        {state === "sending" ? "Надсилаємо…" : (data.buttonLabel ?? "Надіслати")}
      </button>
      {state === "error" && (
        <p className="wire-text wire-leadform__error" role="alert">
          Не вдалося надіслати. Спробуйте ще раз або зателефонуйте нам.
        </p>
      )}
    </form>
  );
}
